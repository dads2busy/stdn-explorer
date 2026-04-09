"""Regenerate the Word document from pandoc, then resize images to 60%
page width. Skip text wrapping to avoid XML corruption."""

import subprocess
from docx import Document
from docx.shared import Inches
from docx.oxml.ns import qn

# First regenerate a clean docx from pandoc
subprocess.run([
    "pandoc", "STDN_Explorer_Overview.md",
    "-o", "STDN_Explorer_Overview.docx",
    "--resource-path=.",
    "-f", "markdown",
    "-t", "docx",
], cwd="/Users/ads7fg/git/stdn-explorer/docs", check=True)

doc = Document("/Users/ads7fg/git/stdn-explorer/docs/STDN_Explorer_Overview.docx")

# 60% of 6.5 inch usable width
TARGET_WIDTH = Inches(6.5 * 0.6)

for paragraph in doc.paragraphs:
    for run in paragraph.runs:
        drawings = run._element.findall(qn('w:drawing'))
        for drawing in drawings:
            inline = drawing.find(qn('wp:inline'))
            if inline is None:
                continue

            extent = inline.find(qn('wp:extent'))
            if extent is None:
                continue

            orig_cx = int(extent.get('cx'))
            orig_cy = int(extent.get('cy'))

            if orig_cx <= 0:
                continue

            scale = int(TARGET_WIDTH) / orig_cx
            new_cx = int(TARGET_WIDTH)
            new_cy = int(orig_cy * scale)

            # Update the extent
            extent.set('cx', str(new_cx))
            extent.set('cy', str(new_cy))

            # Update the pic:spPr extent too
            for ext in inline.iter(qn('a:ext')):
                if int(ext.get('cx', '0')) == orig_cx:
                    ext.set('cx', str(new_cx))
                    ext.set('cy', str(new_cy))

    # Center paragraphs that contain images
    for run in paragraph.runs:
        if run._element.findall(qn('w:drawing')):
            paragraph.alignment = 1  # WD_ALIGN_PARAGRAPH.CENTER
            break

doc.save("/Users/ads7fg/git/stdn-explorer/docs/STDN_Explorer_Overview.docx")
print("Done - images resized to 60% width, centered")
