import pytest

from app.services.dose import dose_key


@pytest.mark.parametrize(
    ("dose", "key"),
    [
        # Spacing and case don't matter.
        ("600mg", "600mg"),
        ("600 mg", "600mg"),
        (" 600 MG ", "600mg"),
        # Weights are converted to mg.
        ("1g", "1000mg"),
        ("1 gr", "1000mg"),
        ("0,5 g", "500mg"),
        ("500 mcg", "0.5mg"),
        ("500µg", "0.5mg"),
        # Comma or dot decimals, and dots as thousands separators.
        ("2,5 mg", "2.5mg"),
        ("2.5mg", "2.5mg"),
        ("1.000mg", "1000mg"),
        ("2.50 mg", "2.5mg"),
        # Other units are kept, but still unified.
        ("4%", "4%"),
        ("4 %", "4%"),
        ("2,0 %", "2%"),
        ("5 ml", "5ml"),
        ("1000 UI", "1000ui"),
        # Concentrations: each side of the slash on its own.
        ("100mg/5ml", "100mg/5ml"),
        ("100 mg / 5 ml", "100mg/5ml"),
        ("0,1g/100ml", "100mg/100ml"),
        ("1g/100g", "1000mg/100000mg"),
        ("17,5mg/5ml", "17.5mg/5ml"),
        ("248000 UI/100g", "248000ui/100000mg"),
        # Anything else: the text without spaces, in lower case.
        ("mg/", "mg/"),
        ("one tablet", "onetablet"),
        ("1.2.3mg", "1.2.3mg"),
    ],
)
def test_dose_key(dose, key):
    assert dose_key(dose) == key


def test_equal_amounts_share_a_key():
    assert dose_key("1g") == dose_key("1000 mg") == dose_key("1.000mg")
    assert dose_key("1 g/100 g") == dose_key("1000mg/100g")
    assert dose_key("600 mg") != dose_key("400 mg")
    # Different units never match: a syrup isn't a tablet.
    assert dose_key("4%") != dose_key("4mg")
