import * as expect from 'expect';
import {Timezones} from "../src/app/components/Timezones";

describe('Timezones', function () {
    beforeEach('Create new time obj', function () {
        this.time = new Timezones("12:00", "Europe/London");
    });


    it('has the correct outputs the correct original time', function () {
        // args: [time, original_timezone]
        const timeFormats = [
            {args: ["01:00", "Europe/Zurich"], expected: "01:00"},
            {args: ["04:00", "Europe/London"], expected: "04:00"},
            {args: ["05:15", "Europe/Budapest"], expected: "05:15"},
            {args: ["13:25", "Asia/Jerusalem"], expected: "13:25"},
            {args: ["21:30", "Asia/Hong_Kongh"], expected: "21:30"},
            {args: ["23:45", "America/New_York"], expected: "23:45"},
        ];
        timeFormats.forEach(function (test) {
            const time = new Timezones(test.args[0], test.args[1]);
            expect(time.toOriginalTime()).toEqual(test.expected);
        });
    });

    it('converts the time into the correct timezone', function () {
        // the set time
        const setTime = "12:00";
        // args: [original_timezone, local_timezone]
        // expected: [non_dlt, dlt]
        const timeConversation = [
            {args: ["Europe/London", "Africa/Johannesburg"], expected: ["14:00", "13:00"]},
            {args: ["Europe/London", "America/New_York"], expected: ["06:00", "07:00"]},
            {args: ["Europe/London", "America/Los_Angeles"], expected: ["03:00", "04:00"]},
            {args: ["Europe/London", "Asia/Hong_Kong"], expected: ["19:00", "19:00"]},
            {args: ["Europe/London", "Australia/Perth"], expected: ["20:00", "19:00"]},
            {args: ["Africa/Johannesburg", "Europe/London"], expected: ["11:00", "11:00"]},
            {args: ["America/New_York", "Europe/London"], expected: ["16:00", "17:00"]},
            {args: ["America/Los_Angeles", "Europe/London"], expected: ["19:00", "20:00"]},
            {args: ["Asia/Hong_Kong", "Europe/London"], expected: ["05:00", "05:00"]},
            {args: ["Australia/Perth", "Europe/London"], expected: ["05:00", "05:00"]}
        ];

        timeConversation.forEach(function (test) {
            const time = new Timezones(setTime, test.args[0], test.args[1]);
            const dlt = time.isDayLightTime();
            const expected = dlt ? test.expected[1] : test.expected[0];
            expect(time.toLocalTime()).toEqual(expected);
        });
    });
});