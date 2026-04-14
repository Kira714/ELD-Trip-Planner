"""
FMCSA Hours of Service Calculator for Property-Carrying Drivers
Rules enforced (49 CFR Part 395):
  - 11-hour driving limit per shift
  - 14-hour on-duty window per shift
  - 30-minute break required after 8 cumulative driving hours
  - 10 consecutive hours off duty between shifts
  - 70-hour / 8-day rolling on-duty limit
  - Fuel stop at least every 1,000 miles
  - 1 hour pickup + 1 hour dropoff (On Duty Not Driving)
  - Pre-trip inspection: 30 min On Duty Not Driving (start of each day)
  - Post-trip inspection: 30 min On Duty Not Driving (end of each day)
  - Average truck speed: 55 mph
"""

from datetime import datetime, timedelta, date
import math

AVG_SPEED_MPH = 55.0
MAX_DRIVING_HOURS = 11.0
MAX_WINDOW_HOURS = 14.0
REQUIRED_OFF_DUTY_HOURS = 10.0
MAX_CYCLE_HOURS = 70.0
BREAK_TRIGGER_HOURS = 8.0
BREAK_DURATION_HOURS = 0.5
FUEL_INTERVAL_MILES = 1000.0
FUEL_STOP_HOURS = 0.5       # 30 min fuel stop (On Duty Not Driving)
PICKUP_HOURS = 1.0
DROPOFF_HOURS = 1.0
PRE_TRIP_HOURS = 0.5
POST_TRIP_HOURS = 0.5
SHIFT_START_HOUR = 6.0      # Default shift start: 6:00 AM
MAX_SIMULATION_DAYS = 60
MAX_DRIVE_LOOP_STEPS = 300
MAX_NO_PROGRESS_STEPS = 40

OFF_DUTY = "off_duty"
SLEEPER_BERTH = "sleeper_berth"
DRIVING = "driving"
ON_DUTY_ND = "on_duty_not_driving"


def hours_to_hhmm(h):
    """Convert decimal hours to HH:MM string."""
    h = max(0.0, min(24.0, h))
    hh = int(h)
    mm = int(round((h - hh) * 60))
    if mm == 60:
        hh += 1
        mm = 0
    return f"{hh:02d}:{mm:02d}"


def calculate_trip_schedule(
    total_distance_miles: float,
    distance_to_pickup: float,
    distance_pickup_to_dropoff: float,
    current_cycle_used: float,
    start_location: str,
    pickup_location: str,
    dropoff_location: str,
    start_date: date = None,
    waypoints: list = None,
):
    """
    Master scheduling function. Returns daily_logs and stop_events.

    Args:
        total_distance_miles: Full trip distance (start -> pickup -> dropoff)
        distance_to_pickup: Miles from current location to pickup
        distance_pickup_to_dropoff: Miles from pickup to dropoff
        current_cycle_used: Hours already used in the 8-day cycle
        start_location, pickup_location, dropoff_location: location name strings
        start_date: Date object for day 1 (defaults to today)
        waypoints: list of {"lat", "lng"} dicts along route

    Returns dict with daily_logs and stop_events.
    """
    if start_date is None:
        start_date = date.today()

    cycle_used = float(current_cycle_used)
    available_cycle_hours = MAX_CYCLE_HOURS - cycle_used

    scheduler = TripScheduler(
        distance_to_pickup=distance_to_pickup,
        distance_pickup_to_dropoff=distance_pickup_to_dropoff,
        cycle_used=cycle_used,
        available_cycle_hours=available_cycle_hours,
        start_location=start_location,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        start_date=start_date,
    )

    scheduler.run()

    return {
        "daily_logs": scheduler.daily_logs,
        "stop_events": scheduler.stop_events,
        "trip_summary": scheduler.get_summary(),
    }


class TripScheduler:
    """
    Simulates a truck driver's trip schedule compliant with FMCSA HOS.
    Maintains a timeline of activities and generates per-day log entries.
    """

    def __init__(self, distance_to_pickup, distance_pickup_to_dropoff,
                 cycle_used, available_cycle_hours,
                 start_location, pickup_location, dropoff_location, start_date):
        self.distance_to_pickup = distance_to_pickup
        self.distance_pickup_to_dropoff = distance_pickup_to_dropoff
        self.cycle_used = cycle_used
        self.available_cycle_hours = available_cycle_hours
        self.start_location = start_location
        self.pickup_location = pickup_location
        self.dropoff_location = dropoff_location
        self.start_date = start_date

        # State tracking
        self.current_day = 1
        self.current_hour = SHIFT_START_HOUR  # hour within current day (0-24)
        self.daily_logs = []
        self.stop_events = []
        self.current_segments = []  # segments for current day
        self.current_remarks = []
        self.current_miles = 0.0
        self.total_miles_driven = 0.0

        # HOS counters (reset on 10h off duty)
        self.driving_hours_this_shift = 0.0
        self.on_duty_hours_this_shift = 0.0
        self.window_start_hour = None  # absolute hour when shift window opened
        self.cumulative_driving_since_break = 0.0

        # Fuel tracking
        self.miles_since_fuel = 0.0

        self._current_location = start_location

    def _absolute_hour(self):
        """Hours since trip start (day-relative)."""
        return (self.current_day - 1) * 24 + self.current_hour

    def _add_segment(self, status, duration_hours, location=None):
        """Add a duty status segment to the current day."""
        loc = location or self._current_location
        start_h = self.current_hour
        end_h = self.current_hour + duration_hours

        # If this segment spills into next day, split it
        if end_h > 24.0:
            first_duration = 24.0 - start_h
            second_duration = end_h - 24.0
            if first_duration > 0:
                self.current_segments.append({
                    "status": status,
                    "start_hour": round(start_h, 4),
                    "end_hour": 24.0,
                    "location": loc,
                })
            self._close_day()
            # Add pre-trip inspection if it's a new work day (non-off-duty)
            if second_duration > 0:
                self.current_segments.append({
                    "status": status,
                    "start_hour": 0.0,
                    "end_hour": round(second_duration, 4),
                    "location": loc,
                })
            self.current_hour = second_duration
        else:
            self.current_segments.append({
                "status": status,
                "start_hour": round(start_h, 4),
                "end_hour": round(end_h, 4),
                "location": loc,
            })
            self.current_hour = end_h

        # Update HOS counters
        if status == DRIVING:
            self.driving_hours_this_shift += duration_hours
            self.on_duty_hours_this_shift += duration_hours
            self.cumulative_driving_since_break += duration_hours
            self.cycle_used += duration_hours
            self.available_cycle_hours -= duration_hours
        elif status == ON_DUTY_ND:
            self.on_duty_hours_this_shift += duration_hours
            self.cycle_used += duration_hours
            self.available_cycle_hours -= duration_hours

    def _close_day(self):
        """Finalize current day's log and start a new day."""
        if self.current_day > MAX_SIMULATION_DAYS:
            raise ValueError(
                "Trip simulation exceeded maximum planning window. "
                "Please use clearer pickup/drop locations or split the trip."
            )
        # Fill remaining hours as off duty if not already at 24
        if self.current_hour < 24.0 and self.current_segments:
            last = self.current_segments[-1]
            if last["end_hour"] < 24.0:
                self.current_segments.append({
                    "status": OFF_DUTY,
                    "start_hour": round(self.current_hour, 4),
                    "end_hour": 24.0,
                    "location": self._current_location,
                })

        # Calculate totals
        totals = {OFF_DUTY: 0.0, SLEEPER_BERTH: 0.0, DRIVING: 0.0, ON_DUTY_ND: 0.0}
        for seg in self.current_segments:
            dur = seg["end_hour"] - seg["start_hour"]
            totals[seg["status"]] = round(totals[seg["status"]] + dur, 4)

        log_date = self.start_date + timedelta(days=self.current_day - 1)
        self.daily_logs.append({
            "day": self.current_day,
            "date": log_date.strftime("%m/%d/%Y"),
            "miles_today": round(self.current_miles, 1),
            "segments": list(self.current_segments),
            "totals": {k: round(v, 2) for k, v in totals.items()},
            "remarks": list(self.current_remarks),
            "location_end": self._current_location,
        })

        # Reset for new day
        self.current_day += 1
        self.current_hour = 0.0
        self.current_segments = []
        self.current_remarks = []
        self.current_miles = 0.0

    def _start_shift(self):
        """Begin a new driving shift: pre-trip inspection."""
        self.window_start_hour = self.current_hour
        self.driving_hours_this_shift = 0.0
        self.on_duty_hours_this_shift = 0.0
        self.cumulative_driving_since_break = 0.0

        # Pre-trip inspection (30 min On Duty Not Driving)
        self._add_remark(f"Pre-trip inspection — {self._current_location}")
        self._add_segment(ON_DUTY_ND, PRE_TRIP_HOURS)

    def _end_shift(self):
        """End driving shift: post-trip inspection then 10h off duty."""
        self._add_remark(f"Post-trip — {self._current_location}")
        self._add_segment(ON_DUTY_ND, POST_TRIP_HOURS)

        # 10 hours off duty (may span midnight)
        self._add_remark(f"Rest — {self._current_location}")
        self._add_segment(OFF_DUTY, REQUIRED_OFF_DUTY_HOURS)

        # Reset counters
        self.driving_hours_this_shift = 0.0
        self.on_duty_hours_this_shift = 0.0
        self.cumulative_driving_since_break = 0.0
        self.window_start_hour = None

    def _add_remark(self, text):
        self.current_remarks.append(text)

    def _take_break(self):
        """30-minute mandatory break (off duty or on duty not driving)."""
        self._add_remark(f"30-min break — {self._current_location}")
        self._add_segment(OFF_DUTY, BREAK_DURATION_HOURS)
        self.cumulative_driving_since_break = 0.0
        # Break does NOT extend the 14-hour window

    def _drive_segment(self, miles, destination=None):
        """
        Drive a segment, splitting into sub-segments as needed for:
        - 30-min break after 8h cumulative driving
        - 11h driving limit
        - 14h window limit
        - 70h cycle limit
        - Fuel stops every 1000 miles
        """
        remaining_miles = miles

        steps = 0
        no_progress_steps = 0
        previous_remaining = remaining_miles
        while remaining_miles > 0.001:
            steps += 1
            if steps > MAX_DRIVE_LOOP_STEPS:
                raise ValueError(
                    "Trip simulation became unstable for this route. "
                    "Please retry using city/state style locations."
                )
            # If cycle is exhausted, we cannot legally drive more.
            # Stop with a clear error instead of looping day rollover forever.
            if self.available_cycle_hours <= 0.001:
                raise ValueError(
                    "Insufficient 70-hour cycle availability to complete this trip. "
                    "Reduce current cycle used or split the trip after cycle recapture."
                )

            # How many hours of driving are available?
            drive_available = min(
                MAX_DRIVING_HOURS - self.driving_hours_this_shift,
                BREAK_TRIGGER_HOURS - self.cumulative_driving_since_break,
                self.available_cycle_hours,
            )

            # 14-hour window constraint
            if self.window_start_hour is not None:
                window_hours_used = self.on_duty_hours_this_shift
                window_remaining = MAX_WINDOW_HOURS - window_hours_used
                drive_available = min(drive_available, window_remaining)

            if drive_available <= 0.001:
                # Must stop and rest
                self._end_shift()
                self._start_shift()
                continue

            # How far can we go before needing a fuel stop?
            miles_to_fuel = FUEL_INTERVAL_MILES - self.miles_since_fuel
            max_miles_this_leg = min(
                drive_available * AVG_SPEED_MPH,
                miles_to_fuel,
                remaining_miles
            )

            if max_miles_this_leg <= 0.001:
                # Fuel stop needed
                self._add_remark(f"Fuel stop — {self._current_location}")
                self._add_segment(ON_DUTY_ND, FUEL_STOP_HOURS)
                self.stop_events.append({
                    "type": "fuel",
                    "location": self._current_location,
                    "day": self.current_day,
                    "hour": self.current_hour,
                })
                self.miles_since_fuel = 0.0
                continue

            drive_time = max_miles_this_leg / AVG_SPEED_MPH
            dest = destination if remaining_miles <= max_miles_this_leg else None

            self._add_segment(DRIVING, drive_time, dest)
            if dest:
                self._current_location = dest
            self.current_miles += max_miles_this_leg
            self.total_miles_driven += max_miles_this_leg
            self.miles_since_fuel += max_miles_this_leg
            remaining_miles -= max_miles_this_leg

            if remaining_miles >= previous_remaining - 1e-6:
                no_progress_steps += 1
            else:
                no_progress_steps = 0
            previous_remaining = remaining_miles
            if no_progress_steps > MAX_NO_PROGRESS_STEPS:
                raise ValueError(
                    "Trip simulation stalled for this route. "
                    "Please choose a clearer pickup/drop location."
                )

            # Check if break needed
            if self.cumulative_driving_since_break >= BREAK_TRIGGER_HOURS - 0.001:
                self._take_break()

            # Check if driving limit hit
            if self.driving_hours_this_shift >= MAX_DRIVING_HOURS - 0.001:
                self._end_shift()
                self._start_shift()

    def _add_stop_event(self, stop_type, location):
        self.stop_events.append({
            "type": stop_type,
            "location": location,
            "day": self.current_day,
            "hour": self.current_hour,
        })

    def run(self):
        """Execute the full trip schedule."""
        # Day 1 starts with off duty from midnight to shift start
        self._add_segment(OFF_DUTY, SHIFT_START_HOUR)
        self._add_remark(f"Start — {self._current_location}")

        # Record start stop
        self._add_stop_event("start", self._current_location)

        # Begin shift
        self._start_shift()

        # === Phase 1: Drive to pickup ===
        if self.distance_to_pickup > 0:
            self._drive_segment(self.distance_to_pickup, self.pickup_location)
        self._current_location = self.pickup_location

        # === Phase 2: Pickup (1 hour On Duty Not Driving) ===
        self._add_remark(f"Pickup — {self.pickup_location}")
        self._add_stop_event("pickup", self.pickup_location)
        self._add_segment(ON_DUTY_ND, PICKUP_HOURS)

        # Check if window is about to expire; if so, rest then resume
        if (self.on_duty_hours_this_shift >= MAX_WINDOW_HOURS - 0.5 or
                self.driving_hours_this_shift >= MAX_DRIVING_HOURS - 0.5):
            self._end_shift()
            self._start_shift()

        # === Phase 3: Drive to dropoff ===
        self._drive_segment(self.distance_pickup_to_dropoff, self.dropoff_location)
        self._current_location = self.dropoff_location

        # === Phase 4: Dropoff (1 hour On Duty Not Driving) ===
        self._add_remark(f"Dropoff — {self.dropoff_location}")
        self._add_stop_event("dropoff", self.dropoff_location)
        self._add_segment(ON_DUTY_ND, DROPOFF_HOURS)

        # End shift
        self._end_shift()
        self._add_stop_event("end", self.dropoff_location)

        # Close final day
        if self.current_segments:
            self._close_day()

        # Post-process: merge consecutive same-status segments
        for log in self.daily_logs:
            log["segments"] = _merge_segments(log["segments"])

    def get_summary(self):
        total_driving = sum(
            log["totals"].get(DRIVING, 0) for log in self.daily_logs
        )
        total_on_duty = sum(
            log["totals"].get(DRIVING, 0) + log["totals"].get(ON_DUTY_ND, 0)
            for log in self.daily_logs
        )
        return {
            "total_miles": round(self.total_miles_driven, 1),
            "total_days": len(self.daily_logs),
            "total_driving_hours": round(total_driving, 2),
            "total_on_duty_hours": round(total_on_duty, 2),
            "cycle_hours_used_after_trip": round(self.cycle_used, 2),
        }


def _merge_segments(segments):
    """Merge consecutive segments with the same status."""
    if not segments:
        return segments
    merged = [dict(segments[0])]
    for seg in segments[1:]:
        last = merged[-1]
        if (seg["status"] == last["status"] and
                abs(seg["start_hour"] - last["end_hour"]) < 0.01):
            last["end_hour"] = seg["end_hour"]
            if seg.get("location") and seg["location"] != last.get("location"):
                last["location"] = seg["location"]
        else:
            merged.append(dict(seg))
    return merged
