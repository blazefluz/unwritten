# 3-minute demo script

Record on Nov 3 from a real run. Use only real numbers from that run. If the model gets
one wrong, keep it in: a visible miss shows the score is real.

**Before recording:** `python -m unwritten serve`, open a finished clip, restart it, set
speed to 1×, and leave "Pause on each prediction" on.

| Time | Show | Say |
|---|---|---|
| 0:00–0:20 | The expert at work | "Experts follow rules nobody wrote down. Ask them and they say: you just know." |
| 0:20–0:45 | Upload the clip, log scrolling | "Unwritten watches with Muse Spark on Meta's Model API and logs every decision it sees." |
| 0:45–1:10 | Notebook: "How the rules were found" | "Muse Spark proposes rules. Plain code checks them, and the mistakes go back to the model. It never grades itself." |
| 1:10–2:05 | **The player**: the first predictions, then the reveals | "These decisions were held out. It predicts each one before it happens. [Let two or three play.] [Read the real score.] A one-attribute baseline with no AI gets [real baseline]." |
| 2:05–2:40 | Answer a question, click Update the rules | "It knows where its evidence is thin, so it asks the expert about the case it never saw. The answer changes the rule, and code re-scores it." |
| 2:40–3:00 | Eval table, then the rules | "Measured against hand labels on [N] clips: [real numbers]. Knowledge that lived in one person's head is now written down, and tested." |

Do not use the synthetic sample as footage of the product working. If it appears, its
banner must be visible.
