import * as moment from "moment-timezone"

export class Timezones {
    time: string;
    timeFormat: string;
    timeZone: string;

    /**
     * Init Timezones
     *
     * @param time
     * @param timeZone
     */
    public constructor(time: string, timeZone: string) {
        this.time = time;
        this.timeFormat = 'HH:mm';
        this.timeZone = timeZone;
    }

    /**
     * Convert the time to local time
     * @param timeZone
     */
    public toLocalTime(timeZone: string = null) {
        timeZone = timeZone || this.getOriginalTimezone();
        const tSplit = this.time.split(":");
        const localTz = this.getLocalTimezone();
        return moment.tz(`2020-01-01 ${tSplit[0]}:${tSplit[1]}`, timeZone).tz(localTz).format(this.timeFormat);
    }

    /**
     * Return the original time
     */
    public toOriginalTime() {
        const localTz = this.getLocalTimezone();
        return this.toLocalTime(localTz);
    }

    /**
     * Get current local timezone
     */
    public getLocalTimezone() {
        return moment.tz.guess();
    }

    /**
     * Get the original timezone
     */
    public getOriginalTimezone() {
        return this.timeZone;
    }

    /**
     * Get the current time
     *
     * @param timeFormat
     */
    public static getCurrentTime(timeFormat = "HH:mm:ss") {
        return moment().format(timeFormat);
    }

    /**
     * Check if inside a deployment window or not
     *
     * @param startTime
     * @param endTime
     * @param timeFormat
     */
    public static isDeploymentWindow(startTime, endTime, timeFormat = "HH:mm:ss") {
        let time = moment(this.getCurrentTime(), timeFormat),
            beforeTime = moment(startTime + ":00", timeFormat),
            afterTime = moment(endTime + ":00", timeFormat);

        return !time.isBetween(afterTime, beforeTime);
    }
}