# Bundled Fonts

Studio ships **open-licensed faces only**, under the SIL Open Font License 1.1.
The licence text is in [`public/fonts/OFL.txt`](public/fonts/OFL.txt) and applies to
every file listed here.

## The three brand faces

Owned by [`public/fonts/brand-faces.css`](public/fonts/brand-faces.css), which every
window links. These are not operator choices.

| Role | Face | File |
|---|---|---|
| Voice | Source Serif 4 | `SourceSerif4-latin-var.woff2` |
| Interface | Inter | `InterVariable.woff2` |
| Signal | Geist Mono | `GeistMono-latin-400.woff2` |

`display.html` declares Source Serif 4 inline instead, because it serves the browser
and network output and does not link `brand-faces.css`.

## The presentation faces

What an operator can pick for scripture and lyrics. Declared twice on purpose — in
[`display.html`](display.html) for the browser/network output, and in
[`src/shared/display-fonts.ts`](src/shared/display-fonts.ts) for the bundled audience
and stage windows. `npm run verify:fonts` holds the two sets to each other; a face on
one surface but not the other is an operator picking a font and the other screen
substituting something else.

| Family | File | Weights | Copyright |
|---|---|---|---|
| Poppins | `Poppins-{Regular,Medium,Bold}.ttf` | 400, 500, 700 | The Poppins Project Authors |
| Bebas Neue | `BebasNeue-Regular.ttf` | 400 | The Bebas Neue Project Authors |
| Inter | `InterVariable.woff2` | 100–900 | The Inter Project Authors |
| Montserrat | `Montserrat-Variable.ttf` | 100–900 | 2024 The Montserrat Project Authors |
| Roboto | `Roboto-Variable.ttf` | 100–900 | 2011 The Roboto Project Authors |
| Oswald | `Oswald-Variable.ttf` | 200–700 | 2016 The Oswald Project Authors |
| Crimson Pro | `CrimsonPro-Variable.ttf` | 200–900 | 2018 The Crimson Pro Project Authors |
| Playfair Display | `PlayfairDisplay-Variable.ttf` | 400–900 | 2017 The Playfair Display Project Authors, with Reserved Font Name "Playfair Display" |
| Lora | `Lora-Variable.ttf` | 400–700 | 2011 The Lora Project Authors, with Reserved Font Name "Lora" |
| Cinzel | `Cinzel-Variable.ttf` | 400–900 | 2020 The Cinzel Project Authors |

Weight ranges are read from each file's own `fvar` table, not assumed. A range wider
than the font supports is silently clamped; narrower, and the browser synthesises a
fake bold instead of using the real one.

Sourced from [github.com/google/fonts](https://github.com/google/fonts).

## Why eight of these are one file each

They were a Regular/Bold pair until the files behind them turned out to be GitHub
"Page not found" pages — 326 KB of HTML saved under a `.ttf` name, sixteen times
over. Every one of those families silently fell back to a system font on the
projector, which is the surface where the face matters most and the one nobody was
looking at, because the operator console uses the brand faces and looked correct.

The cause is worth recording: Google moved these families to variable fonts, so the
static `Inter-Regular.ttf`-style URLs a fetch went looking for genuinely do not exist
any more. The 404 was accurate. Nothing checked the response.

Hence `verify:fonts`, which reads the four-byte signature of every bundled file. A
`.ttf` extension on an HTML error page is still an HTML error page.

## Adding a face

1. Confirm the licence permits redistribution inside an application. OFL and Apache 2.0
   do. If it does not, it does not go in — route it through the operator's own system
   fonts instead.
2. Download the file and check it is a font: `head -c 4 <file> | xxd -p` must be
   `00010000`, `4f54544f`, `774f4646` or `774f4632`.
3. Read its real weight range rather than guessing (the `fvar` table).
4. Declare it in **both** `display.html` and `src/shared/display-fonts.ts`.
5. Record it in the table above with its copyright line, then run `npm run verify:fonts`.
