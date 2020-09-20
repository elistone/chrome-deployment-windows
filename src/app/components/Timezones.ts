import * as moment from "moment-timezone"

export class Timezones {
    time: string;
    timeFormat: string;
    originalTimeZone: string;
    localTimeZone: string;

    /**
     * Init Timezones
     *
     * @param time - the time we are looking at
     * @param originalTimeZone - the original timezone attached the time
     * @param localTimeZone - an optional local timezone, if not set will try and be calculated
     */
    public constructor(time: string, originalTimeZone: string, localTimeZone: string = null) {
        this.time = time;
        this.timeFormat = 'HH:mm';
        this.originalTimeZone = originalTimeZone;
        this.localTimeZone = localTimeZone || this.findLocalTimezone();
    }

    /**
     * Convert the time to local time
     * @param timeZone
     */
    public toLocalTime(timeZone: string = null) {
        timeZone = timeZone || this.getOriginalTimezone();
        const tSplit = this.time.split(":");
        const localTz = this.getLocalTimezone();
        const date = this.getCurrentDate();
        return moment.tz(`${date.year}-${date.month}-${date.day} ${tSplit[0]}:${tSplit[1]}`, timeZone).tz(localTz).format(this.timeFormat);
    }

    /**
     * Return the original time
     */
    public toOriginalTime() {
        const localTz = this.getLocalTimezone();
        return this.toLocalTime(localTz);
    }

    /**
     * Finds the local timezone
     */
    public findLocalTimezone() {
        return moment.tz.guess();
    }

    /**
     * Get the original timezone
     */
    public getOriginalTimezone() {
        return this.originalTimeZone;
    }

    /**
     * Get current local timezone
     */
    public getLocalTimezone() {
        return this.localTimeZone;
    }

    /**
     * Get the current date
     */
    public getCurrentDate() {
        const d = new Date();
        let day: string | number = d.getDate();
        let month: string | number = d.getMonth() + 1;
        const year: string | number = d.getFullYear();

        day = 10 > day ? `0${day}` : day;
        month = 10 > month ? `0${month}` : month;

        return {
            day,
            month,
            year
        }
    }

    /**
     * Calculates todays date is in or out of daylight saving time.
     */
    public isDayLightTime() {
        const timeZone = this.getOriginalTimezone();
        const date = this.getCurrentDate();
        return moment.tz(`${date.year}-${date.month}-${date.day} 00:00`, timeZone).isDST();
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