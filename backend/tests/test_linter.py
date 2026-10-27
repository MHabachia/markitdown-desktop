import unittest

from backend.linter import clean_blank_lines, format_markdown_tables, generate_toc

CODE_BLOCK = "```\n# kein Heading\n| a | b |\n|-|-|\n| 1 | 2 |\n\n\n\nende   \n```"


class LinterCodeBlockTests(unittest.TestCase):
    def test_tables_inside_code_are_left_alone(self):
        text = f"{CODE_BLOCK}\n\n| Name | Wert |\n|---|---|\n| x | langer Wert |"
        formatted = format_markdown_tables(text)
        self.assertTrue(formatted.startswith(CODE_BLOCK))
        self.assertIn("| x    | langer Wert |", formatted)

    def test_blank_lines_inside_code_are_kept(self):
        text = f"vorher\n\n\n\n{CODE_BLOCK}\n\n\n\nnachher"
        cleaned = clean_blank_lines(text)
        self.assertIn(CODE_BLOCK, cleaned)
        self.assertIn("vorher\n\n```", cleaned)
        self.assertIn("```\n\nnachher", cleaned)

    def test_tilde_fences_and_longer_fences(self):
        text = "~~~\n\n\n\nx\n~~~\n\n````\n```\n\n\n\n```\n````\n"
        self.assertEqual(clean_blank_lines(text), text)

    def test_toc_ignores_headings_in_code(self):
        toc = generate_toc(f"# Titel\n\n{CODE_BLOCK}\n\n## Kapitel")
        self.assertIn("* [Titel](#titel)", toc)
        self.assertIn("  * [Kapitel](#kapitel)", toc)
        self.assertNotIn("kein Heading", toc.split("---")[0])

    def test_toc_ignores_indented_code(self):
        toc = generate_toc("# Titel\n\n    # eingerückter Code\n")
        self.assertNotIn("eingerückter", toc.split("---")[0])


class LinterTableTests(unittest.TestCase):
    def test_escaped_pipe_stays_in_its_cell(self):
        formatted = format_markdown_tables("| Name | Wert |\n|---|---|\n| y \\| z | 1 |")
        rows = formatted.splitlines()
        self.assertEqual(len(rows), 3)
        self.assertIn("| y \\| z | 1    |", rows[2])
        self.assertEqual({row.count("|") - row.count("\\|") for row in rows}, {3})

    def test_alignment_colons_survive(self):
        formatted = format_markdown_tables("| a | b |\n|:--|--:|\n| 1 | 2 |")
        self.assertIn("| :-- | --: |", formatted)


class LinterTocTests(unittest.TestCase):
    def test_repeated_headings_get_numbered_anchors(self):
        toc = generate_toc("# A\n## Kapitel\n## Kapitel\n## Kapitel")
        self.assertIn("(#kapitel)", toc)
        self.assertIn("(#kapitel-1)", toc)
        self.assertIn("(#kapitel-2)", toc)

    def test_indented_first_line_survives_cleanup(self):
        self.assertEqual(clean_blank_lines("    code\n\n\nText"), "    code\n\nText\n")


if __name__ == "__main__":
    unittest.main()
