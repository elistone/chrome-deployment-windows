import * as expect from 'expect';
import {Timezones} from "../src/app/components/Timezones";

describe('Timezones', function () {

    beforeEach('Create new time obj', function () {
        this.time = new Timezones("12:00", "Europe/London", null,  "2020/01/01");
    });

    /**
     * If you set the time the output time is as expected
     * @test
     */
    it('correctly outputs the original time', function () {
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

    /**
     * If you set a time it converts correct to another timezone
     * @test
     */
    it('converts the set time into the correct timezone', function () {
        // the set time
        const setTime = "12:00";
        const date1 = "2020/01/01";
        const date2 = "2020/06/01";
        // args: [original_timezone, local_timezone]
        // expected: [time]
        // date
        const timeConversation = [
            {args: ["Europe/London", "Africa/Johannesburg"], expected: ["14:00"], date: date1},
            {args: ["Europe/London", "America/New_York"], expected: ["07:00"], date: date1},
            {args: ["Europe/London", "America/Los_Angeles"], expected: ["04:00"], date: date1},
            {args: ["Europe/London", "Asia/Hong_Kong"], expected: ["20:00"], date: date1},
            {args: ["Europe/London", "Australia/Perth"], expected: ["20:00"], date: date1},
            {args: ["Europe/London", "Asia/Tokyo"], expected: ["21:00"], date: date1},
            {args: ["Africa/Johannesburg", "Europe/London"], expected: ["10:00"], date: date1},
            {args: ["America/New_York", "Europe/London"], expected: ["17:00"], date: date1},
            {args: ["America/Los_Angeles", "Europe/London"], expected: ["20:00"], date: date1},
            {args: ["Asia/Hong_Kong", "Europe/London"], expected: ["04:00"], date: date1},
            {args: ["Australia/Perth", "Europe/London"], expected: ["04:00"], date: date1},
            {args: ["Asia/Tokyo", "Europe/London"], expected: ["03:00"], date: date1},

            {args: ["Europe/London", "Africa/Johannesburg"], expected: ["13:00"], date: date2},
            {args: ["Europe/London", "America/New_York"], expected: ["07:00"], date: date2},
            {args: ["Europe/London", "America/Los_Angeles"], expected: ["04:00"], date: date2},
            {args: ["Europe/London", "Asia/Hong_Kong"], expected: ["19:00"], date: date2},
            {args: ["Europe/London", "Australia/Perth"], expected: ["19:00"], date: date2},
            {args: ["Europe/London", "Asia/Tokyo"], expected: ["20:00"], date: date2},
            {args: ["Africa/Johannesburg", "Europe/London"], expected: ["11:00"], date: date2},
            {args: ["America/New_York", "Europe/London"], expected: ["17:00"], date: date2},
            {args: ["America/Los_Angeles", "Europe/London"], expected: ["20:00"], date: date2},
            {args: ["Asia/Hong_Kong", "Europe/London"], expected: ["05:00"], date: date2},
            {args: ["Australia/Perth", "Europe/London"], expected: ["05:00"], date: date2},
            {args: ["Asia/Tokyo", "Europe/London"], expected: ["04:00"], date: date2},
        ];

        timeConversation.forEach(function (test) {
            const time = new Timezones(setTime, test.args[0], test.args[1], test.date);
            const expected = test.expected[0];
            expect(time.toLocalTime()).toEqual(expected);
        });
    });

    /**
     * Make sure that we get the correct state for a deployment window.
     */
    it('can work out if time is in a deployment window', function () {
        // args: [start_time, end_time, current_time]
        const deploymentInformation = [
            {args: ['22:00', '06:00', '12:00'], expected: false},
            {args: ['22:00', '06:00', '04:00'], expected: true},
            {args: ['05:00', '22:00', '23:00'], expected: false},
            {args: ['05:00', '22:00', '12:00'], expected: true},
            {args: ['00:00', '23:59', '01:00'], expected: true},
            {args: ['00:00', '23:59', '07:00'], expected: true},
            {args: ['00:00', '23:59', '11:00'], expected: true},
            {args: ['00:00', '23:59', '15:00'], expected: true},
            {args: ['00:00', '23:59', '19:00'], expected: true},
            {args: ['00:00', '23:59', '22:00'], expected: true},
            {args: ['10:00', '10:30', '10:31'], expected: false},
            {args: ['10:00', '10:30', '10:30'], expected: true},

        ]

        deploymentInformation.forEach(function (test) {
            const isDeployment = Timezones.isDeploymentWindow(test.args[0], test.args[1], test.args[2]);
            expect(isDeployment).toEqual(test.expected);
        });
    });
});
