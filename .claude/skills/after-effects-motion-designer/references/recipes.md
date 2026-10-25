# Recipes

## Logo reveal (3 s, 1080p, 30 fps)
1. 0:00-0:18 Trim Paths End 0->100% on stroke version (ease out 80% influence), stroke 6 px.
2. 0:12-0:24 Fill fades in 0->100%, stroke fades out; scale 92->100% ease-out with 4% overshoot.
3. 0:20-0:34 Light sweep: white shape/ramp as Alpha Track Matte, Position X across logo, Add blend, 12 frames.
4. 0:34-2:20 Hold, subtle 100->102% drift. Tagline fades in at 1:00 (offset 8 frames).
5. Add 2% grain; background gradient with slow wiggle.

## Lower third (4 s)
- Bar: scale X 0->100 over 10 f (ease-out). Text masked, slides up 20 px over 12 f, +4 f stagger for title line.
- Hold 2.5 s. Out: reverse at 8 f with ease-in, 2 f faster than in.

## Kinetic type (per word)
- Text animator: Position Y +60, Opacity 0, Range Selector Based On Words, Shape Ramp Up, Ease High 60%, Offset animated 0->100 over 1 s. Add Motion Blur.

## Whip transition
- Adjustment layer: Transform to move 0 -> -1920 px over 6 f (ease-in), then next scene from +1920 -> 0 (ease-out). Directional Blur 0->120 px matching velocity peak.

## Number counter + bar chart
- Slider drives Source Text via round(); bar scale Y = slider/max*100, ease via `ease()`.
