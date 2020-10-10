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
    time: string;
    timeZone: string;
    timeFormat: string;

    /**
     * Init Timezones
     *
     * @param time
     * @param timeZone
     */
    public constructor(time: string, timeZone: string) {
        this.time = time;
        this.timeZone = timeZone;
        this.timeFormat = HH_MM_FORMAT;
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

    private getFormattedTime() {
        const [hours, minutes] = this.time.split(TIME_SEPARATOR);

        return `${FIRST_OF_JAN_2020 } ${hours}${TIME_SEPARATOR}${minutes}`;
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
        return dayjs.tz.guess();
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
    public static getCurrentTime(timeFormat = HH_MM_SS_FORMAT) {
        return dayjs().format(timeFormat);
    }

    /**
     * Check if inside a deployment window or not
     *
     * @param startTime
     * @param endTime
     * @param timeFormat
     */
    public static isDeploymentWindow(startTime, endTime, timeFormat = HH_MM_SS_FORMAT) {
        const time = dayjs(this.getCurrentTime(), timeFormat);
        
        const beforeTime = dayjs(this.withSecondsSuffix(startTime), timeFormat);
        const afterTime = dayjs(this.withSecondsSuffix(endTime), timeFormat);

        return !time.isBetween(afterTime, beforeTime);
    }

    private static withSecondsSuffix(hoursAndMinutes) {
        return hoursAndMinutes + TIME_SEPARATOR + SECONDS_SUFFIX;
    }
}