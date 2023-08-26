// https://developer.scrypted.app/#getting-started
// package.json contains the metadata (name, interfaces) about this device
// under the "scrypted" key.
import { Settings, PositionSensor, ScryptedDeviceBase, Setting, SettingValue, ScryptedInterface } from '@scrypted/sdk';
import axios, { AxiosResponse } from 'axios';

class IPGeolocationSensor extends ScryptedDeviceBase implements Settings, PositionSensor {
    refreshTimer: NodeJS.Timeout

    constructor(nativeId?: string) {
        super(nativeId);
        this.setupGeolocator();
    }

    ipSelf(): string | null {
        return this.storage.getItem('ipSelf');
    }

    ipOverride(): string | null {
        return this.storage.getItem('ipOverride');
    }

    refreshInterval(): number {
        let interval: number = parseInt(this.storage.getItem('refreshInterval'));
        if (isNaN(interval) || interval == 0) {
            interval = 30;
        }
        return interval;
    }

    async getSettings(): Promise<Setting[]> {
        return [
            {
                title: "Autodetected IP",
                key: "ipSelf",
                value: this.ipSelf(),
                description: "The autodetected IP address of this Scrypted server.",
                readonly: true,
            },
            {
                title: "IP Override",
                key: "ipOverride",
                value: this.ipOverride(),
                description: "If set, detects geolocation for the provided IP address. Otherwise, uses this Scrypted server's autodetected IP address.",
                placeholder: "8.8.8.8",
            },
            {
                title: "Refresh Interval",
                key: "refreshInterval",
                value: this.refreshInterval(),
                description: "The interval, in minutes, to refresh the IP's geolocation data.",
                type: "number",
            }
        ]
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {
        this.storage.setItem(key, value as any);
        clearTimeout(this.refreshTimer);
        await this.onDeviceEvent(ScryptedInterface.Settings, null);
        await this.setupGeolocator();
    }

    async refreshSelfIp(): Promise<void> {
        const response: AxiosResponse<any> = await axios.get("https://api.ipify.org");
        this.console.log(`Detected self ip: ${response.data}`);
        this.storage.setItem('ipSelf', response.data);
        await this.onDeviceEvent(ScryptedInterface.Settings, null);
    }

    async setupGeolocator(): Promise<void> {
        try {
            this.console.log("Refreshing geolocator position");
            await this.refreshSelfIp();

            const ip: string = this.ipOverride() || this.ipSelf();
            this.console.log(`Using ${ip}`);
            const response: AxiosResponse<any> = await axios.get(`https://ipapi.co/${ip}/json`);
            const data: any = response.data;
            const latitude: number = data.latitude;
            const longitude: number = data.longitude;

            this.position = { latitude, longitude };
            this.console.log(`Geolocation: ${JSON.stringify(this.position)}`);
        } finally {
            const interval: number = 1000 * 60 * this.refreshInterval();
            this.refreshTimer = setTimeout(() => this.setupGeolocator(), interval);
        }

    }
}

export default IPGeolocationSensor;
