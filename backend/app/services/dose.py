"""Comparable doses.

Doses are free text ("600mg", "600 mg", "1 g", "4%", "100mg/5ml"). To tell whether two
medications have the same composition, each dose also gets a key where equal amounts
look the same: "1g", "1000 mg" and "1.000mg" all become "1000mg".
"""

import re
from decimal import Decimal

# Weights are converted to mg; any other unit (%, ml, UI...) is kept as written.
_TO_MG = {"g": Decimal(1000), "mg": Decimal(1), "mcg": Decimal("0.001")}
_UNIT_ALIASES = {"gr": "g", "µg": "mcg", "μg": "mcg", "ug": "mcg"}

# A number and a unit, nothing else: "600mg", "2,5 %", "1.000 mg".
_AMOUNT = re.compile(r"(?P<number>\d+(?:[.,]\d+)*)(?P<unit>[^\d\s.,]+)")
# "1.000" or "12.500": dots as thousands separators (Spanish), so the dots are dropped.
_THOUSANDS = re.compile(r"[1-9]\d{0,2}(?:\.\d{3})+")


def _parse_number(text: str) -> Decimal | None:
    if _THOUSANDS.fullmatch(text):
        text = text.replace(".", "")
    text = text.replace(",", ".")
    if text.count(".") > 1:
        return None
    return Decimal(text)


def _format(number: Decimal) -> str:
    # normalize() drops trailing zeros ("2.50" -> "2.5"); 'f' avoids "1E+3".
    return f"{number.normalize():f}"


def _amount_key(text: str) -> str | None:
    """'600mg' -> '600mg', '1g' -> '1000mg', '4%' -> '4%'; None if it isn't one amount."""
    match = _AMOUNT.fullmatch(text)
    if match is None:
        return None
    number = _parse_number(match["number"])
    if number is None:
        return None
    unit = _UNIT_ALIASES.get(match["unit"], match["unit"])
    if unit in _TO_MG:
        return f"{_format(number * _TO_MG[unit])}mg"
    return f"{_format(number)}{unit}"


def dose_key(dose: str) -> str:
    """The dose with spacing, case and units unified, for comparing compositions.

    Concentrations ("0,1 g/100 ml") are unified on each side of the slash, so they
    compare as written: "1g/100g" equals "1000mg/100g", but not "1%".
    Anything else that isn't a plain number and unit falls back to the text without
    spaces, in lower case: it still matches when written the same way.
    """
    text = re.sub(r"\s+", "", dose).lower()
    parts = [_amount_key(part) for part in text.split("/")]
    if None in parts:
        return text
    return "/".join(parts)
