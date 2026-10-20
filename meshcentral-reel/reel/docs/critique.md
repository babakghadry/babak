# Critique log

## Round 1
| hook | read | motion | variety | brand | sync | min |
|  7   |  6   |   7    |    6    |   8   |  8   |  6  |

- hook 7: b0 the digit block is already mid-flight on frame 0 and lands on the impact; the top line is small and the "waiting" label is unreadable at phone size.
- read 6: supers collide on hand-offs (b6.5-7 «هنوز…» leaving through «منتظری…», b39.5-40, b131-132 CTA into the end card); dome tiles behind «امن می‌مونه» (b115-119); mono labels (YOUR SERVER, OPEN SOURCE) vanish on the phone page; RELAY label clipped at the left edge (b31).
- motion 7: springs, flips and the orbit read well; the drop frame b52 is a white wash with huge blurred letters; the dome shot replays the tower drop from scratch (b111-113).
- variety 6: b33-44 is 5 s of a tiny cluster and one arc on empty dark: the "foreign servers" idea never gets a picture.
- brand 8: real MeshCentral UI (desktop + mobile), real icon, palette held, Vazirmatn + JetBrains Mono only.
- sync 8: 37/47 within 20 ms, median 5.4 ms; the misses are soft whooshes/subs under the voice where the detector locks to syllables. -14.0 LUFS, -1.1 dBTP.

Worst three:
1. [b33-44] Look-back frames are empty: the relay is off-frame and home is a speck -> the core claim ("your data sits on foreign servers") has no image -> world.js 'foreign' camera: after arriving at the relay (b31.5) pull back to a wide high view down the link (home bottom of frame, relay top) and hold it with a slow push to b44.
2. [b6.5-7, b39.5-40, b131-132, b101-103, b115-119] Supers overlap each other, the check badge sits on «حل», dome tiles sit under the type -> words are unreadable for a beat at a time -> outgoing supers leave 0.6 beat before the next word; a top scrim (ink, 0.7 -> 0) behind supers on every 3-D shot; the check badge placed from the measured line width; the dome camera looks higher so the dome sits low in frame.
3. [b52] The downbeat frame is a white wash -> the drop's first frame must show the word -> letters start at b51.2 (word formed by the downbeat, last letters still slamming), flash 0.55 -> 0.28.

Also: secure mode keeps the answer layout (tower already landed) and only adds the dome; backstage panels centred and larger from behind; mono labels 40 px.

Checks failed: readable captions (hand-off collisions); gap: none over 4 s, but b33-44 is visually static.
Verdict: ANOTHER ROUND

## Round 2
| hook | read | motion | variety | brand | sync | min |
|  8   |  7   |   8    |    7    |   8   |  8   |  7  |

- hook 8: b0 digits mid-flight on frame 0, impact on the landing; the top line arrives by b1 and is readable; the spinner no longer crosses the type.
- read 7: hand-offs clean now (b7, b40, b114, b131); the scrim keeps the top band readable over the links and the dome; but b126 «برای کسی که شبکه‌ت دستشه» runs off the left edge, and the backstage terminal sits under the top line (b95-103).
- motion 8: the drop frame b52 now shows the word forming (flash 0.28); dome builds on the settled ring instead of replaying the drop.
- variety 7: b34-43 still loses the rack: in 9x16 the camera sees only +-11 deg across, and the rack sits outside it (only a slab on the edge, home a speck).
- brand 8, sync 8 (unchanged).

Worst three:
1. [b34-43] Behind-the-rack camera frames the rack out of a 22-degree-wide portrait view -> the "foreign servers hold your data" beat shows an arc on black -> camera at (27, 6, -139.7) looking at (14.1, 7, -91.4): rack fills the right of frame, home small left of centre down the link; drift to (31, 9.5, -147).
2. [b95-103] Terminal panel left of centre and under the top line, mono text ~24 px on screen -> the "behind the scenes" payoff is hard to read -> centre the panels from behind (target x 0.05, y 0), terminal type 42 px with 84 px leading.
3. [b123-127] CTA line 2 overflows at 82 px -> rebreak as «این پست رو بفرست برای» / «کسی که شبکه‌ت دستشه»; browser card 0.4 lower so line 2 of 8c clears the URL bar (b81-87).

Checks failed: caption overflow at b126.
Verdict: ANOTHER ROUND

## Round 3
| hook | read | motion | variety | brand | sync | min |
|  8   |  8   |   8    |    8    |   8   |  8   |  8  |

- hook 8: b0 the nine-digit code is mid-slam on frame 0 with the impact; «هنوز برای وصل شدن…» lands by b1; flips speed up on «بفرستن؟».
- read 8: every super clears the next (b7, b33, b40, b78, b80, b94, b100, b114, b122, b127, b131); the top scrim holds the band over the links, the rack and the dome; the CTA rebreak fits at 82 px; terminal type 42 px is legible at full size (small on the phone page, but the line that matters is the accent «Running»).
- motion 8: strips show the stamp pushes through into the world (b13.55-14), the whip keeps both shots on screen (b87.3-88.2), and the flood now carries the portrait in, so b119.75 opens on his face, not on flat yellow.
- variety 8: rack now fills the right of frame with blinking bays on all three faces while the link arcs in from a distant home (b34-43); something new every 2-4 s throughout; longest still stretch is the end card hold.
- brand 8: real MeshCentral UI (desktop + mobile, captured from a live MeshCentral 1.2.5), real icon; palette = ink / paper / the portrait's mustard + MeshCentral blue; Vazirmatn + JetBrains Mono only.
- sync 8: 37/47 hits within 20 ms (median 5.4 ms); the rest are soft whooshes/subs under speech; -14.0 LUFS / -1.1 dBTP.

Worst three (remaining, for a next pass):
1. [b88-94] the employee's monitor is a generic document graphic; a quick real shot of a Windows desktop would sell "without disturbing the employee" better.
2. [b119-132] the portrait sits as a hard-edged square (the artwork's own crop at the jacket); a soft yellow fade on its bottom edge would melt it into the ground.
3. [b0-12] the tick SFX on flips are buried under the voice; either lift them 3 dB or drop them.

Checks: no banned defaults; longest gap without a new event < 4 s; one structural flash (the drop, 0.28); one accent; end card holds 1.9 s; matches the shot list (deviation: the relay shot became a behind-the-rack view, which carries the line better).
Verdict: READY
(Items 2 and 3 fixed before the final render: a 190 px yellow fade melts the portrait's bottom edge; flip ticks +5 dB.)
