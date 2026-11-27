# Worked examples

Each one is a request someone might make, the exact arguments to pass to
`create_workout` (the same object works for `validate_workout`), and notes on
the choices. Every `json` block on this page is built and validated by the
dotworkout test suite, so these are known to produce files the Watch accepts.

After `create_workout`, always reply with the full link it returns, on its own
line. See "The one rule" in SKILL.md.

## Running

### Norwegian 4×4

> "Build me a Norwegian 4×4 for tomorrow's run."

```json
{
  "activity": "RUNNING",
  "name": "Norwegian 4×4",
  "warmup": { "time": "10min", "alert": { "kind": "heartRateZone", "zone": 2 } },
  "blocks": [
    {
      "repeat": 4,
      "work": { "time": "4:00" },
      "rest": "3:00",
      "label": "hard",
      "alert": { "kind": "heartRateZone", "zone": 4 }
    }
  ],
  "cooldown": { "time": "5min", "alert": { "kind": "heartRateZone", "zone": 1 } }
}
```

The protocol is four 4 minute efforts at 85–95% of max heart rate with 3 minute
active recoveries. Zone 4 is the closest Watch zone. The recovery after the last
interval is part of the set, so the cool down can be short.

### Tempo run on a pace band

> "Tempo run: 2 km easy, 5 km at 4:30 to 4:40 per km, 1 km easy."

```json
{
  "activity": "RUNNING",
  "name": "Tempo 5K",
  "warmup": { "distance": "2km", "alert": { "kind": "heartRateZone", "zone": 2 } },
  "blocks": [
    {
      "repeat": 1,
      "work": { "distance": "5km" },
      "label": "tempo",
      "alert": { "kind": "paceRange", "from": "4:40/km", "to": "4:30/km" }
    }
  ],
  "cooldown": { "distance": "1km" }
}
```

Paces go in as written; the server converts them. The order of `from` and `to`
does not matter.

### Track 400s

> "8 × 400 m at 5K pace (3:50/km) with 90 seconds standing rest."

```json
{
  "activity": "RUNNING",
  "name": "8 × 400",
  "warmup": { "distance": "2km" },
  "blocks": [
    {
      "repeat": 8,
      "work": { "distance": "400m" },
      "rest": "1:30",
      "alert": { "kind": "pace", "pace": "3:50/km" }
    }
  ],
  "cooldown": { "distance": "1km" }
}
```

`"400m"`, never `"400"`: running defaults to kilometres.

### Mile repeats, in miles

> "Four mile repeats at 7:00 pace, two minutes jog between."

```json
{
  "activity": "RUNNING",
  "name": "Mile repeats",
  "warmup": { "distance": "1mi" },
  "blocks": [
    {
      "repeat": 4,
      "work": { "distance": "1mi" },
      "rest": "2:00",
      "alert": { "kind": "pace", "pace": "7:00/mi" }
    }
  ],
  "cooldown": { "distance": "1mi" }
}
```

Units are kept as written, so the Watch shows miles.

### Easy long run

> "90 minute long run, keep me in zone 2."

```json
{
  "activity": "RUNNING",
  "name": "Long run",
  "blocks": [
    { "repeat": 1, "work": { "time": "1:30:00" }, "alert": { "kind": "heartRateZone", "zone": 2 } }
  ]
}
```

A single steady effort is one block with `repeat: 1`. `"1:30:00"` is 90
minutes; `"1:30"` would be 90 seconds.

### Treadmill progression

> "Treadmill run, 3 × 8 minutes getting faster: 5:30, 5:10, 4:50 per km."

```json
{
  "activity": "RUNNING",
  "location": "indoor",
  "name": "Treadmill progression",
  "warmup": { "time": "10min" },
  "blocks": [
    { "repeat": 1, "work": { "time": "8min" }, "alert": { "kind": "pace", "pace": "5:30/km" } },
    { "repeat": 1, "work": { "time": "8min" }, "alert": { "kind": "pace", "pace": "5:10/km" } },
    { "repeat": 1, "work": { "time": "8min" }, "alert": { "kind": "pace", "pace": "4:50/km" } }
  ],
  "cooldown": { "time": "5min" }
}
```

Indoors a run takes pace and heart rate only: no cadence, no power.

## Cycling

### FTP 2 × 20 on the trainer

> "2 × 20 at threshold on the turbo. My FTP is 265."

```json
{
  "activity": "CYCLING",
  "location": "indoor",
  "name": "2 × 20 threshold",
  "warmup": { "time": "15min", "alert": { "kind": "powerRange", "from": 130, "to": 180 } },
  "blocks": [
    {
      "repeat": 2,
      "work": { "time": "20min" },
      "rest": "5min",
      "alert": { "kind": "powerRange", "from": 240, "to": 255 }
    }
  ],
  "cooldown": { "time": "10min" }
}
```

240–255 W is 91–96% of 265. Work out the watts from the FTP the user gives; say
what range you chose. Indoor cycling has no distance goal and no speed target.

### Norwegian 4×4 on the bike

> "Same 4×4 but on the indoor bike."

```json
{
  "activity": "CYCLING",
  "location": "indoor",
  "name": "Norwegian 4×4 bike",
  "warmup": { "time": "10min", "alert": { "kind": "heartRateZone", "zone": 2 } },
  "blocks": [
    {
      "repeat": 4,
      "work": { "time": "4:00" },
      "rest": "3:00",
      "alert": { "kind": "heartRateZone", "zone": 4 }
    }
  ],
  "cooldown": { "time": "5min" }
}
```

### 30/30 VO2 max

> "Ten 30/30s at 400 watts."

```json
{
  "activity": "CYCLING",
  "location": "indoor",
  "name": "30/30s",
  "warmup": { "time": "15min" },
  "blocks": [
    {
      "repeat": 10,
      "work": { "time": "30s" },
      "rest": "30s",
      "alert": { "kind": "power", "watts": 400 }
    }
  ],
  "cooldown": { "time": "10min" }
}
```

### Outdoor cadence and speed

> "Road ride: 5 × 1 minute high cadence, 100 to 110, then 20 km steady at about 30 km/h."

```json
{
  "activity": "CYCLING",
  "name": "Spin-ups and steady",
  "warmup": { "time": "10min" },
  "blocks": [
    {
      "repeat": 5,
      "work": { "time": "1:00" },
      "rest": "1:00",
      "label": "spin",
      "alert": { "kind": "cadenceRange", "from": 100, "to": 110 }
    },
    {
      "repeat": 1,
      "work": { "distance": "20km" },
      "label": "steady",
      "alert": { "kind": "kmhRange", "from": 28, "to": 32 }
    }
  ],
  "cooldown": { "time": "10min" }
}
```

Speed targets are outdoor only.

## Swimming

### Pyramid

> "A swimming pyramid, 50 up to 200 and back, 20 seconds rest."

```json
{
  "activity": "SWIMMING",
  "name": "Pyramid",
  "warmup": { "distance": "400", "label": "easy free" },
  "blocks": [
    { "repeat": 1, "work": { "distance": "50" }, "rest": ":20", "label": "free" },
    { "repeat": 1, "work": { "distance": "100" }, "rest": ":20", "label": "free" },
    { "repeat": 1, "work": { "distance": "150" }, "rest": ":20", "label": "free" },
    { "repeat": 1, "work": { "distance": "200" }, "rest": ":20", "label": "free" },
    { "repeat": 1, "work": { "distance": "150" }, "rest": ":20", "label": "free" },
    { "repeat": 1, "work": { "distance": "100" }, "rest": ":20", "label": "free" },
    { "repeat": 1, "work": { "distance": "50" }, "rest": ":20", "label": "free" }
  ],
  "cooldown": { "distance": "200", "label": "easy" }
}
```

Swimming defaults to metres, so a bare `"400"` is 400 m. Laps are not in the
file: pool length is chosen on the Watch when the swim starts.

### Send-off set

> "10 × 100 free on 1:45."

```json
{
  "activity": "SWIMMING",
  "name": "10 × 100 on 1:45",
  "warmup": { "distance": "300" },
  "blocks": [{ "repeat": 10, "work": { "distance": "100" }, "sendOff": "1:45", "label": "free" }],
  "cooldown": { "distance": "200" }
}
```

A send-off means "leave every 1:45 however fast you finish", so there is no
`rest`. Only swimming has send-offs.

### Individual medley

> "IM set: 4 × 25 of each stroke, then 4 × 100 IM, 15 seconds rest."

```json
{
  "activity": "SWIMMING",
  "name": "IM set",
  "warmup": { "distance": "400" },
  "blocks": [
    { "repeat": 4, "work": { "distance": "25" }, "rest": ":15", "label": "fly" },
    { "repeat": 4, "work": { "distance": "25" }, "rest": ":15", "label": "back" },
    { "repeat": 4, "work": { "distance": "25" }, "rest": ":15", "label": "breast" },
    { "repeat": 4, "work": { "distance": "25" }, "rest": ":15", "label": "free" },
    { "repeat": 4, "work": { "distance": "100" }, "rest": ":15", "label": "IM" }
  ],
  "cooldown": { "distance": "200" }
}
```

There is no stroke field; the label carries it and the Watch shows it during
the step.

### Yards

> "Masters set in a yards pool: 6 × 200 yd on 3:00."

```json
{
  "activity": "SWIMMING",
  "name": "6 × 200 yd",
  "warmup": { "distance": "500yd" },
  "blocks": [{ "repeat": 6, "work": { "distance": "200yd" }, "sendOff": "3:00" }],
  "cooldown": { "distance": "200yd" }
}
```

## Everything else

### Tabata

> "A Tabata: 8 rounds of 20 seconds all out, 10 seconds off."

```json
{
  "activity": "HIGH_INTENSITY_INTERVAL_TRAINING",
  "name": "Tabata",
  "warmup": { "time": "5min" },
  "blocks": [{ "repeat": 8, "work": { "time": "20s" }, "rest": "10s", "label": "all out" }],
  "cooldown": { "time": "5min" }
}
```

### Strength circuit

> "Five rounds: 45 seconds each of squats, push-ups and burpees, 15 seconds between, a minute between rounds."

```json
{
  "activity": "FUNCTIONAL_STRENGTH_TRAINING",
  "name": "Full-body circuit",
  "blocks": [
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "squats" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "push-ups" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "1:00", "label": "burpees" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "squats" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "push-ups" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "1:00", "label": "burpees" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "squats" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "push-ups" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "1:00", "label": "burpees" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "squats" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "push-ups" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "1:00", "label": "burpees" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "squats" },
    { "repeat": 1, "work": { "time": "45s" }, "rest": "15s", "label": "push-ups" },
    { "repeat": 1, "work": { "time": "45s" }, "label": "burpees" }
  ]
}
```

A `repeat` covers one step and its rest, so a circuit of different exercises is
written out round by round. Strength sports take time and open goals only.

### Sets you finish yourself

> "Three sets of max push-ups, two minutes between."

```json
{
  "activity": "TRADITIONAL_STRENGTH_TRAINING",
  "name": "Max push-ups",
  "blocks": [{ "repeat": 3, "work": { "open": true }, "rest": "2:00", "label": "max push-ups" }]
}
```

An open step has no goal; the wearer taps to end it.

### Indoor rowing

> "Erg session: 4 × 8 minutes in zone 3, 2 minutes easy between."

```json
{
  "activity": "ROWING",
  "location": "indoor",
  "name": "4 × 8 erg",
  "warmup": { "time": "10min" },
  "blocks": [
    {
      "repeat": 4,
      "work": { "time": "8min" },
      "rest": "2:00",
      "alert": { "kind": "heartRateZone", "zone": 3 }
    }
  ],
  "cooldown": { "time": "5min" }
}
```

Indoor rowing has no distance goal. Outdoors it does:

```json
{
  "activity": "ROWING",
  "name": "3 × 2000 m",
  "warmup": { "distance": "1000" },
  "blocks": [{ "repeat": 3, "work": { "distance": "2000" }, "rest": "4:00" }],
  "cooldown": { "distance": "1000" }
}
```

### Brisk walk

> "30 minute brisk walk, heart rate 110 to 125."

```json
{
  "activity": "WALKING",
  "name": "Brisk walk",
  "blocks": [
    {
      "repeat": 1,
      "work": { "time": "30min" },
      "alert": { "kind": "heartRateRange", "from": 110, "to": 125 }
    }
  ]
}
```

## Mistakes the validator catches

Each of these fails `validate_workout` with an error naming the step. They are
here so you know what not to write; the test suite checks that each one fails.

A power target on a swim: swimming takes heart rate only.

```json invalid
{
  "activity": "SWIMMING",
  "blocks": [
    { "repeat": 4, "work": { "distance": "100" }, "alert": { "kind": "power", "watts": 200 } }
  ]
}
```

A distance on an indoor bike: the trainer measures no distance.

```json invalid
{
  "activity": "CYCLING",
  "location": "indoor",
  "blocks": [{ "repeat": 1, "work": { "distance": "20km" } }]
}
```

A send-off on a run: only swimming has them. Use `rest` instead.

```json invalid
{
  "activity": "RUNNING",
  "blocks": [{ "repeat": 6, "work": { "distance": "400m" }, "sendOff": "2:00" }]
}
```

A pace target on a treadmill is fine, but cadence is not:

```json invalid
{
  "activity": "RUNNING",
  "location": "indoor",
  "blocks": [
    { "repeat": 1, "work": { "time": "20min" }, "alert": { "kind": "cadence", "perMinute": 180 } }
  ]
}
```

A bare distance on a run: `"400"` is 400 km, so the server warns. Write
`"400m"`.

```json warning
{
  "activity": "RUNNING",
  "blocks": [{ "repeat": 8, "work": { "distance": "400" }, "rest": "1:30" }]
}
```
