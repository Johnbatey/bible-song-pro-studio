# Bundled Bible Translations

Bible Song Pro bundles **public-domain scripture only**, in the **66-book Protestant
canon**. Editions carrying the Apocrypha or Deuterocanon are not shipped, in any
language.

## What ships

Stored in `assets/bibles/` as `{ "Genesis": { "1": { "1": "text" } } }`, registered
in `VERSION_META` in `src/electron/bible-service.cjs`.

| Code | Translation | First published | Language | Source | Copyright |
|---|---|---|---|---|---|
| `KJV` | King James Version | 1611 / 1769 | English | eBible.org `engkjv` | Public domain |
| `ASV` | American Standard Version | 1901 | English | eBible.org `eng-asv` | Public domain |
| `Darby` | Darby Translation | 1890 | English | eBible.org `engDBY` | Public domain |
| `YLT` | Young's Literal Translation | 1862 / 1898 | English | eBible.org `engylt` | Public domain |
| `LSG` | Louis Segond | 1910 | French | eBible.org `fraLSG` | Public domain |

eBible.org lists each of these as `public domain`, `Redistributable: True`, with
39 Old Testament books, 27 New Testament books and **0 deuterocanonical books**.

## Why not NIV, NKJV, NLT, NASB or ESV

They are copyrighted (Biblica, Thomas Nelson, Tyndale, Lockman, Crossway) and their
licences do not permit redistributing the full text inside an application. Bundling
them would also imply licensing them under this project's terms, which is not a
right this project holds over someone else's translation.

**Users can still use them** by importing a copy they are licensed to use. Bible
Song Pro does not host, mirror, or link to copyrighted scripture text, and will not
point anyone to a source for one.

Speech-detection aliases for those translations remain in `LiveScripturePanel.tsx`
on purpose — someone who imports NKJV should still be able to say "New King James"
and be understood.

## Guards

| Guard | Runs | Checks |
|---|---|---|
| `scripts/usfx-to-bible.cjs` | at conversion | canon by USFX book code — language-independent |
| `scripts/test-bible-canon.cjs` | `npm run verify:bibles` | every bundled JSON has exactly the 66 canonical books |
| `scripts/check-bible-licensing.cjs` | pre-commit hook, CI | refuses to commit an unvetted translation |

Install the hook after cloning:

```sh
node scripts/install-hooks.cjs
```

## Adding a translation

1. Confirm public domain **and** 66-book canon. eBible.org's `translations.csv`
   lists `Copyright`, `OTbooks`, `NTbooks` and `DCbooks` — `DCbooks` must be `0`.
2. Convert: `node scripts/usfx-to-bible.cjs <usfx.xml> --code CODE --format json --out assets/bibles/CODE.json`
3. Register it in `VERSION_META` in `src/electron/bible-service.cjs`.
4. Add the code to `ALLOWED_TRANSLATIONS` in `scripts/check-bible-licensing.cjs`.
5. Record it in the table above, then run `npm run verify:bibles`.

If it is not public domain, it does not go in this list — however often it is
requested. Route it through the import feature instead.

Scripture texts sourced from [eBible.org](https://ebible.org).
