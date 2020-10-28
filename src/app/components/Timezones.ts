import * as dayjs from "dayjs"
import * as utc from "dayjs/plugin/utc";
import * as customParseFormat from "dayjs/plugin/customParseFormat";
import * as timezone from "dayjs/plugin/timezone";
import * as isBetween from "dayjs/plugin/isBetween";

dayjs.extend(utc);
dayjs.extend(customParseFormat);
dayjs.extend(timezone);
dayjs.extend(isBetween);

const HH_MM_FORMAT = 'HH:mm';
const HH_MM_SS_FORMAT = 'HH:mm:ss';

const TIME_SEPARATOR = ':';

const FIRST_OF_JAN_2020 = '2020-01-01';
const SECONDS_SUFFIX = '00';

export class Timezones {
    static currentDate: string;
    time: string;
    timeFormat: string;
    originalTimeZone: string;
    localTimeZone: string;

    /**
     * Init Timezones
     *
     * @param time - the time we are looking at
     * @param originalTimeZone - the original timezone attached the time
     * @param localTimeZone - optional local timezone, if not set will try and be calculated
     * @param currentDate - optional current date if set will override getting the date today, format should be YYYY/MM/DD
     */
    public constructor(time: string, originalTimeZone: string, localTimeZone: string = null, currentDate: string = null) {
        this.time = time;
        this.timeFormat = HH_MM_FORMAT;
        this.originalTimeZone = originalTimeZone;
        this.localTimeZone = localTimeZone || Timezones.findLocalTimezone();
        Timezones.currentDate = currentDate;
    }

    /**
     * Convert the time to local time
     * @param timeZone
     */
    public toLocalTime(timeZone: string = null) {
        timeZone = timeZone || this.getOriginalTimezone();
        const formattedTime = this.getFormattedTime();
        const localTz = this.getLocalTimezone();
        return dayjs.tz(formattedTime, timeZone).tz(localTz).format(this.timeFormat);
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
    public static findLocalTimezone() {
        return dayjs.tz.guess();
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
     * Get the time in a formatted state
     * @private
     */
    private getFormattedTime() {
        const [hours, minutes] = this.time.split(TIME_SEPARATOR);
        const date = Timezones.getCurrentDate();
        return `${date.year}-${date.month}-${date.day} ${hours}${TIME_SEPARATOR}${minutes}`;
    }

    /**
     * Get the current time
     *
     * @param setTime
     * @param timeFormat
     */
    public static getCurrentTime(setTime: string = null, timeFormat = HH_MM_SS_FORMAT) {
        const date = Timezones.getCurrentDate();
        return !setTime ? dayjs().format(timeFormat) : dayjs(`${date.year}-${date.month}-${date.day} ${setTime}`).format(timeFormat);
    }

    /**
     * Check if inside a deployment window or not
     *
     * @param startTime
     * @param endTime
     * @param setTime
     * @param timeFormat
     */
    public static isDeploymentWindow(startTime: string, endTime: string, setTime: string = null, timeFormat: string = HH_MM_SS_FORMAT) {
        const time = dayjs(this.getCurrentTime(setTime), timeFormat);
        let beforeTime = dayjs(this.withSecondsSuffix(startTime), timeFormat);
        let afterTime = dayjs(this.withSecondsSuffix(endTime), timeFormat);

        if (afterTime < beforeTime) {
            return !time.isBetween(afterTime, beforeTime);
        }

        beforeTime = beforeTime.add(-1, 'm');
        afterTime = afterTime.add(1, 'm');
        return time.isBetween(beforeTime, afterTime);
    }

    /**
     * Get the current date
     */
    public static getCurrentDate() {
        let day: string | number;
        let month: string | number;
        let year: string | number;

        if (typeof Timezones.currentDate !== "undefined" && Timezones.currentDate !== null) {
            const date = Timezones.currentDate.split("/");
            day = parseInt(date[2]);
            month = parseInt(date[1]);
            year = parseInt(date[0]);
        } else {
            const d = new Date();
            day = d.getDate();
            month = d.getMonth() + 1;
            year = d.getFullYear();
        }

        day = 10 > day ? `0${day}` : day;
        month = 10 > month ? `0${month}` : month;
        return {day, month, year}
    }

    /**
     * get the time in hours and minutes with seconds suffix
     *
     * @param hoursAndMinutes
     * @private
     */
    private static withSecondsSuffix(hoursAndMinutes) {
        return hoursAndMinutes + TIME_SEPARATOR + SECONDS_SUFFIX;
    }
}
