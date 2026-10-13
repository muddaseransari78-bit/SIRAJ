"""Try the model on ONE recording before you trust it.

  cd pronunciation-service
  python try_model.py my_recitation.m4a

It prints what the model heard and how many letters carry zabar / zer / pesh marks.
Use a recitation where you KNOW the right answer, then recite the same Ayah with one deliberate
vowel mistake and check that the printed text changes there. If it does not, this model is not good
enough for you yet: try the bigger MODEL_ID (see README.md).
"""
import re
import sys

import app  # loads the model exactly like the real service does

if len(sys.argv) < 2:
    raise SystemExit("Usage: python try_model.py <audio file>")

with open(sys.argv[1], "rb") as f:
    samples = app.decode_audio(f.read())
text = app.run_model(samples)

letters = len(re.findall(r"[\u0621-\u064A]", text))
marks = len(re.findall(r"[\u064B-\u0652\u0670\u06E1]", text))
print("MODEL :", app.MODEL_ID, "on", app.DEVICE)
print("HEARD :", text)
print(f"MARKS : {marks} marks on {letters} letters" + ("" if marks else "  <-- NO harakat: this model cannot be used for the zabar/zer check"))
