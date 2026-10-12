"""Generates lion-and-sun.svg — a hand-built vector emblem of the Lion and Sun."""
import math, pathlib

W = H = 1024
CX = CY = 512
SUN = (566, 500)
OUT = pathlib.Path(__file__).with_name("lion-and-sun.svg")


def pt(c, r, a):
    return c[0] + r * math.cos(a), c[1] + r * math.sin(a)


def f(x):
    return f"{x:.1f}"


def sun_rays():
    rays = []
    n = 32
    for i in range(n):
        a = -math.pi / 2 + i * 2 * math.pi / n
        if i % 2 == 0:  # long straight ray
            w = math.radians(4.2)
            p1, p2, tip = pt(SUN, 118, a - w), pt(SUN, 118, a + w), pt(SUN, 252, a)
            rays.append(f'<path class="ray" d="M{f(p1[0])} {f(p1[1])} L{f(tip[0])} {f(tip[1])} L{f(p2[0])} {f(p2[1])}Z"/>')
        else:  # wavy flame ray
            d = []
            steps = 14
            for s in range(steps + 1):
                t = s / steps
                r = 118 + t * 92
                off = math.sin(t * math.pi * 2.6) * 0.07 * (1 - t * 0.4)
                half = math.radians(5.5) * (1 - t) + 0.004
                d.append((r, a + off - half, a + off + half))
            left = [pt(SUN, r, l) for r, l, _ in d]
            right = [pt(SUN, r, rr) for r, _, rr in d][::-1]
            pts = left + right
            path = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts) + "Z"
            rays.append(f'<path class="flame" d="{path}"/>')
    return "\n    ".join(rays)


def mane(cx, cy, rx, ry, base, amp, tufts, rot, phase=0.0):
    """Flame-like ring of tufts drawn with quadratic curves."""
    pts = []
    for i in range(tufts * 2):
        a = phase + i * math.pi / tufts
        r = base + (amp if i % 2 == 0 else 0)
        x = cx + r * rx * math.cos(a)
        y = cy + r * ry * math.sin(a)
        pts.append((x, y, a))
    d = []
    for i in range(0, len(pts), 2):
        tip = pts[i]
        valley = pts[(i + 1) % len(pts)]
        # swirl the tip backwards (to the right, away from the face) for movement
        sx = tip[0] + rot * math.cos(tip[2] + math.pi / 2)
        sy = tip[1] + rot * math.sin(tip[2] + math.pi / 2)
        if i == 0:
            prev = pts[-1]
            d.append(f"M{f(prev[0])} {f(prev[1])}")
        d.append(f"Q{f(sx)} {f(sy)} {f(valley[0])} {f(valley[1])}")
    return " ".join(d) + "Z"


def ring_dots():
    out = []
    for i in range(72):
        a = i * 2 * math.pi / 72
        x, y = pt((CX, CY), 462, a)
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{3.2 if i % 3 == 0 else 1.8}"/>')
    return "\n    ".join(out)


svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0" stop-color="#1d4a63"/>
      <stop offset="0.6" stop-color="#0f2b3c"/>
      <stop offset="1" stop-color="#06131c"/>
    </radialGradient>
    <radialGradient id="glow" cx="{SUN[0]}" cy="{SUN[1]}" r="330" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffd76a" stop-opacity="0.55"/>
      <stop offset="0.5" stop-color="#ffb03a" stop-opacity="0.15"/>
      <stop offset="1" stop-color="#ffb03a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="disc" cx="45%" cy="40%" r="65%">
      <stop offset="0" stop-color="#fff1b0"/>
      <stop offset="0.55" stop-color="#ffcf4d"/>
      <stop offset="1" stop-color="#f29a1c"/>
    </radialGradient>
    <linearGradient id="rayg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe08a"/>
      <stop offset="1" stop-color="#f4a62a"/>
    </linearGradient>
    <linearGradient id="fur" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6c45c"/>
      <stop offset="0.65" stop-color="#e2a03c"/>
      <stop offset="1" stop-color="#c47d24"/>
    </linearGradient>
    <linearGradient id="furFar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cf8a2c"/>
      <stop offset="1" stop-color="#a5621b"/>
    </linearGradient>
    <linearGradient id="maneBack" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#b8661a"/>
      <stop offset="1" stop-color="#8a4612"/>
    </linearGradient>
    <linearGradient id="maneFront" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e9a33c"/>
      <stop offset="1" stop-color="#c57422"/>
    </linearGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f4f7fa"/>
      <stop offset="0.5" stop-color="#c9d3dc"/>
      <stop offset="1" stop-color="#8a98a6"/>
    </linearGradient>
    <clipPath id="sky"><rect x="0" y="0" width="1024" height="640"/></clipPath>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7dc8a"/>
      <stop offset="1" stop-color="#c8902c"/>
    </linearGradient>
  </defs>
  <style>
    .ray {{ fill: url(#rayg); stroke: #c9771a; stroke-width: 1.5; }}
    .flame {{ fill: #ffc547; stroke: #c9771a; stroke-width: 1.5; }}
    .ink {{ stroke: #5c300b; stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }}
    .line {{ fill: none; stroke: #6b3a0e; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }}
    .face {{ fill: none; stroke: #9a4f0c; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }}
  </style>

  <rect width="{W}" height="{H}" fill="url(#bg)"/>

  <!-- frame -->
  <circle cx="{CX}" cy="{CY}" r="478" fill="none" stroke="url(#gold)" stroke-width="6"/>
  <circle cx="{CX}" cy="{CY}" r="446" fill="none" stroke="url(#gold)" stroke-width="2"/>
  <g fill="#e8c26a">
    {ring_dots()}
  </g>

  <!-- sun -->
  <circle cx="{SUN[0]}" cy="{SUN[1]}" r="330" fill="url(#glow)"/>
  <g clip-path="url(#sky)">
    {sun_rays()}
  </g>
  <circle cx="{SUN[0]}" cy="{SUN[1]}" r="120" fill="url(#disc)" stroke="#c9771a" stroke-width="3"/>
  <g transform="translate({SUN[0]} {SUN[1]})">
    <!-- brows -->
    <path class="face" d="M-62 -38 Q-38 -56 -12 -40"/>
    <path class="face" d="M12 -40 Q38 -56 62 -38"/>
    <!-- eyes -->
    <path d="M-60 -16 Q-38 -34 -16 -16 Q-38 -4 -60 -16Z" fill="#fff6d6" stroke="#9a4f0c" stroke-width="2.5"/>
    <path d="M16 -16 Q38 -34 60 -16 Q38 -4 16 -16Z" fill="#fff6d6" stroke="#9a4f0c" stroke-width="2.5"/>
    <circle cx="-36" cy="-17" r="7" fill="#4a250a"/>
    <circle cx="38" cy="-17" r="7" fill="#4a250a"/>
    <!-- nose -->
    <path class="face" d="M0 -34 Q-3 0 -12 18 Q0 26 12 18"/>
    <!-- lips -->
    <path d="M-30 44 Q-14 36 0 42 Q14 36 30 44 Q14 60 0 58 Q-14 60 -30 44Z" fill="#e4691f" stroke="#9a4f0c" stroke-width="2.5"/>
    <path class="face" d="M-30 44 Q0 50 30 44" stroke-width="2"/>
    <!-- cheeks -->
    <circle cx="-64" cy="22" r="14" fill="#f08a2c" opacity="0.35"/>
    <circle cx="64" cy="22" r="14" fill="#f08a2c" opacity="0.35"/>
  </g>

  <!-- ground -->
  <path d="M320 834 H830" stroke="#e0b65c" stroke-width="5" stroke-linecap="round"/>
  <path d="M360 848 H800" stroke="#c8902c" stroke-width="2" stroke-linecap="round" opacity="0.7"/>

  <!-- far hind leg (stepping back) -->
  <path class="ink" fill="url(#furFar)" d="M612 680 C656 680 678 708 668 740 C662 768 656 790 654 812 C662 824 656 834 636 834 L600 834 C590 826 600 816 620 812 C622 784 620 752 606 722 Z"/>

  <!-- tail -->
  <path d="M772 640 C826 640 846 590 824 540 C806 500 822 456 868 452" fill="none" stroke="#5c300b" stroke-width="18" stroke-linecap="round"/>
  <path d="M772 640 C826 640 846 590 824 540 C806 500 822 456 868 452" fill="none" stroke="#e2a03c" stroke-width="11" stroke-linecap="round"/>
  <path class="ink" fill="url(#maneBack)" d="M858 456 C866 430 884 418 904 414 C894 426 900 434 914 432 C904 444 912 452 926 454 C910 462 912 472 922 482 C904 482 892 476 880 470 C870 468 862 464 858 456Z"/>

  <!-- body -->
  <path class="ink" fill="url(#fur)" d="M390 640 C395 600 430 585 480 588 C560 594 640 590 700 588 C745 586 775 610 778 645 C782 690 760 715 725 720 C660 722 600 700 540 705 C480 710 430 720 405 700 C390 688 386 665 390 640Z"/>
  <!-- rib / flank lines -->
  <path class="line" d="M560 640 C575 655 578 675 570 695" opacity="0.6"/>
  <path class="line" d="M590 632 C606 650 608 672 600 692" opacity="0.5"/>

  <!-- near hind leg -->
  <path class="ink" fill="url(#fur)" d="M690 612 C752 604 792 652 780 702 C774 730 778 758 788 788 L794 812 C808 824 798 834 776 834 L744 834 C734 826 746 816 764 812 L754 786 C738 758 704 740 690 720 C664 690 656 640 690 612Z"/>
  <path class="line" d="M700 640 C735 650 756 678 748 708"/>
  <path class="line" d="M612 834 l0 -10 M624 834 l0 -11 M636 834 l0 -10" stroke="#4a250a"/>
  <path class="line" d="M754 834 l0 -10 M766 834 l0 -11 M778 834 l0 -10"/>

  <!-- near front leg (standing) -->
  <path class="ink" fill="url(#fur)" d="M398 652 C446 652 466 684 456 718 C448 748 440 780 438 810 C446 822 440 834 420 834 L382 834 C372 826 382 816 404 812 C408 780 404 742 394 712 Z"/>
  <path class="line" d="M394 834 l0 -10 M406 834 l0 -11 M418 834 l0 -10"/>
  <path class="line" d="M450 720 l10 8 l-12 2"/>

  <!-- mane -->
  <path class="ink" fill="url(#maneBack)" d="{mane(352, 500, 1.0, 1.08, 108, 34, 15, 14, phase=0.1)}"/>
  <path class="ink" fill="url(#maneFront)" d="{mane(356, 498, 1.0, 1.06, 84, 26, 13, 10, phase=0.35)}"/>
  <!-- mane curls -->
  <g class="line" stroke="#7a3d0d">
    <path d="M410 440 q14 6 10 22"/>
    <path d="M424 500 q14 8 6 26"/>
    <path d="M404 560 q12 10 2 26"/>
    <path d="M360 590 q8 12 -6 24"/>
    <path d="M396 404 q16 0 18 16"/>
  </g>

  <!-- ear -->
  <path class="ink" fill="#e9a33c" d="M352 420 C350 396 366 382 384 388 C390 404 380 420 368 428Z"/>
  <path d="M360 418 C360 404 368 396 378 398" fill="none" stroke="#8a4612" stroke-width="3" stroke-linecap="round"/>

  <!-- head -->
  <path class="ink" fill="url(#fur)" d="M372 422 C340 404 298 410 278 430 C266 442 262 452 248 460 C236 466 236 480 246 484 C252 492 250 500 258 504 C270 512 284 508 292 514 C290 528 300 538 318 538 C352 538 386 512 390 476 C392 450 386 432 372 422Z"/>
  <!-- brow -->
  <path class="line" d="M286 436 C298 428 316 428 330 436"/>
  <!-- eye -->
  <path d="M292 450 Q306 438 322 448 Q306 458 292 450Z" fill="#fff3c8" stroke="#4a250a" stroke-width="2.4"/>
  <circle cx="307" cy="448" r="5" fill="#2d1606"/>
  <!-- nose -->
  <path d="M240 466 C246 460 256 462 258 470 C254 478 244 478 240 472Z" fill="#3a1d07"/>
  <path class="line" d="M262 452 C276 452 286 460 290 470"/>
  <!-- mouth -->
  <path class="line" d="M252 494 C262 500 276 504 296 508 C300 512 300 518 296 522"/>
  <path d="M262 500 l4 8 l4 -7" fill="#fff6dc" stroke="#5c300b" stroke-width="1.5"/>
  <!-- whisker dots -->
  <g fill="#7a3d0d"><circle cx="268" cy="486" r="2.2"/><circle cx="278" cy="484" r="2.2"/><circle cx="274" cy="492" r="2.2"/><circle cx="286" cy="490" r="2.2"/></g>
  <!-- cheek fur -->
  <path class="line" d="M330 530 l10 12 l2 -14 l12 10 l0 -14"/>

  <!-- sword (shamshir) -->
  <g transform="translate(8 -52)">
    <path d="M206 600 C200 520 186 420 150 300 C146 288 148 276 156 266 C176 330 214 440 226 598Z" fill="url(#blade)" stroke="#4c5864" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M214 590 C206 500 190 410 162 300" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.7"/>
    <!-- guard -->
    <path d="M186 606 C196 596 230 596 244 606 C236 614 194 614 186 606Z" fill="url(#gold)" stroke="#6b3a0e" stroke-width="2.5"/>
    <circle cx="186" cy="606" r="6" fill="url(#gold)" stroke="#6b3a0e" stroke-width="2"/>
    <circle cx="244" cy="606" r="6" fill="url(#gold)" stroke="#6b3a0e" stroke-width="2"/>
    <!-- grip + pommel -->
    <path d="M208 612 L222 612 L226 670 C224 680 206 680 204 670Z" fill="#7a3d0d" stroke="#4a250a" stroke-width="2"/>
    <path d="M204 670 C196 684 206 696 216 692 C226 688 222 676 226 670Z" fill="url(#gold)" stroke="#6b3a0e" stroke-width="2"/>
  </g>

  <!-- raised front leg holding the sword -->
  <path class="ink" fill="url(#fur)" d="M436 606 C404 584 352 584 300 576 C272 572 254 566 240 566 C216 566 204 580 208 594 C212 608 232 612 252 606 C280 600 304 612 334 626 C372 644 418 666 452 650 C472 636 468 608 436 606Z"/>
  <!-- paw toes wrapped round the grip -->
  <path class="line" d="M216 576 C224 578 228 586 224 594 M228 572 C236 576 238 586 234 594 M242 570 C250 576 252 586 246 596"/>
  <path class="line" d="M300 596 C324 598 348 606 368 618" opacity="0.6"/>
  <path class="line" d="M330 626 l-10 12 l14 -4" opacity="0.8"/>
</svg>
'''

OUT.write_text(svg)
print("wrote", OUT)
