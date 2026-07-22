"""Digitize the red Taylor--Maccoll curves from NASA AIAA 2020-0103 Figure 4."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("/Users/apl/Documents/LST and PSE/tmp/pdfs/20200002932/page-8.png")
DESTINATION = ROOT / "validation" / "figure4_tm.json"

X_BOXES = ((426, 554), (567, 695), (709, 836), (850, 978))
VELOCITY_Y = (801, 1057)
TEMPERATURE_Y = (1121, 1377)
STATIONS_M = (0.2, 0.4, 0.6, 0.8)


def red_mask(rgb: np.ndarray) -> np.ndarray:
    red, green, blue = np.moveaxis(rgb, -1, 0)
    return (red > 150) & (red > 1.35 * green) & (red > 1.35 * blue) & (green < 175)


def digitize(mask: np.ndarray, x_box, y_box, x_limits, first_velocity=False):
    left, right = x_box
    top, bottom = y_box
    yy, xx = np.where(mask[top : bottom + 1, left : right + 1])
    x_value = x_limits[0] + xx / (right - left) * (x_limits[1] - x_limits[0])
    y_value = (bottom - (yy + top)) / (bottom - top) * 1.4
    points = []
    for center in np.linspace(0.025, 1.375, 28):
        selected = np.abs(y_value - center) <= 0.027
        if not np.any(selected):
            continue
        values = x_value[selected]
        # Figure 4(a), first panel contains a red TM legend segment.  The physical
        # curve is the rightmost red cluster at those large wall-normal positions.
        value = np.quantile(values, 0.90) if first_velocity and center > 1.05 else np.median(values)
        points.append([round(float(value), 6), round(float(center), 6)])
    return points


def main():
    image = np.asarray(Image.open(SOURCE).convert("RGB"))
    mask = red_mask(image)
    cases = []
    for index, (station, x_box) in enumerate(zip(STATIONS_M, X_BOXES)):
        cases.append(
            {
                "station_m": station,
                "velocity_u_over_uinf_vs_y_mm": digitize(
                    mask, x_box, VELOCITY_Y, (0.0, 1.0), first_velocity=index == 0
                ),
                "temperature_T_over_Tinf_vs_y_mm": digitize(
                    mask, x_box, TEMPERATURE_Y, (1.0, 3.0)
                ),
            }
        )
    payload = {
        "source": "Paredes et al., AIAA 2020-0103 / NASA 20200002932, Figure 4",
        "curve": "TM: sharp-cone self-similar solution based on Taylor-Maccoll edge conditions",
        "digitization": "Red curve pixels extracted from a 2.2x rendering of PDF page 8; plot axes calibrated from frame pixels.",
        "conditions": {
            "cone_half_angle_deg": 7.0,
            "angle_of_attack_deg": 0.0,
            "M_inf": 5.30,
            "T_inf_K": 201.4,
            "p_inf_Pa": 6878.1,
            "unit_Re_inf_1_m": 13.42e6,
            "wall_temperature_K": 393.44,
        },
        "cases": cases,
    }
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_text(json.dumps(payload, indent=2) + "\n")
    print(DESTINATION)


if __name__ == "__main__":
    main()
