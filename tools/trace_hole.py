#!/usr/bin/env python3
"""
trace_hole.py — turn a reference IMAGE into an editor hole outline.

Usage:  python3 tools/trace_hole.py <image> [tolerance] [out.json]
        tolerance: contour-simplify amount, 0.002 (lots of detail) .. 0.010 (chunky). default 0.004
        out.json:  default = <repo>/traced.json (served at :8236, loaded by the editor's "Load traced" button)

Fresh OpenCV pipeline (NOT the old generateHullFromImage):
  1. classify TERRAIN vs SKY  (warm/red pixels = terrain; falls back to "differs from the sky colour")
  2. findContours (RETR_CCOMP) -> the terrain's outline + any enclosed HOLES (caves)
  3. approxPolyDP simplify
  4. stitch holes into the outline with invisible BRIDGE seams (so nonzero-fill carves them)
  5. detect the yellow flag -> cup x
  6. emit {tee, cup, verts} scaled to the editor's 960x540 space
"""
import cv2, numpy as np, json, sys, os

EDW, EDH = 960.0, 540.0
path = sys.argv[1]
tol = float(sys.argv[2]) if len(sys.argv) > 2 else 0.004
out_path = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'traced.json')

img = cv2.imread(path)
if img is None:
    print('ERROR: could not read', path); sys.exit(1)
H, W = img.shape[:2]
b, g, r = [img[:, :, i].astype(int) for i in (0, 1, 2)]

# --- terrain mask: warm (R-dominant) ground. Fallback: anything that differs from the sky colour. ---
mask = ((r > g + 15) & (r > b + 15)).astype(np.uint8) * 255
if mask.sum() < 0.04 * 255 * W * H:
    sky = img[3:8, :, :].reshape(-1, 3).mean(axis=0)
    mask = (np.abs(img.astype(int) - sky).sum(axis=2) > 60).astype(np.uint8) * 255
ks = max(3, (W // 160) | 1)
k = np.ones((ks, ks), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)

cnts, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
hier = hier[0]
outers = [i for i in range(len(cnts)) if hier[i][3] == -1]
oi = max(outers, key=lambda i: cv2.contourArea(cnts[i]))
outer = cnts[oi]
holes = [cnts[i] for i in range(len(cnts)) if hier[i][3] == oi and cv2.contourArea(cnts[i]) > 0.004 * cv2.contourArea(outer)]


def simp(c):
    return cv2.approxPolyDP(c, tol * cv2.arcLength(c, True), True).reshape(-1, 2)


def nearest(A, B):
    A = np.asarray(A); B = np.asarray(B)
    d = ((A[:, None, :] - B[None, :, :]) ** 2).sum(axis=2)
    i, j = np.unravel_index(d.argmin(), d.shape)
    return int(i), int(j)


path_pts = [tuple(p) for p in simp(outer)]
for hole in holes:                                   # stitch each cave in with a bridge seam (invisible)
    hl = [tuple(p) for p in simp(hole)]
    pi, hj = nearest(path_pts, hl)
    loop = hl[hj:] + hl[:hj] + [hl[hj]]              # hole loop, starts+ends at hj (cv2 winds holes opposite → carves)
    path_pts = path_pts[:pi + 1] + loop + [path_pts[pi]] + path_pts[pi + 1:]

verts = [{'x': int(round(x * EDW / W)), 'y': int(round(y * EDH / H))} for (x, y) in path_pts]

# --- cup: centroid of the yellow flag, if present ---
ym = ((r > 150) & (g > 110) & (b < 110) & (r - b > 50)).astype(np.uint8) * 255
cupx = 600
yc, _ = cv2.findContours(ym, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
if yc:
    M = cv2.moments(max(yc, key=cv2.contourArea))
    if M['m00'] > 0:
        cupx = int(round((M['m10'] / M['m00']) * EDW / W))

json.dump({'tee': {'x': 100}, 'cup': {'x': cupx}, 'verts': verts}, open(out_path, 'w'))
print('outer verts %d | holes %d | total verts %d | cup x %d -> %s'
      % (len(simp(outer)), len(holes), len(verts), cupx, out_path))
