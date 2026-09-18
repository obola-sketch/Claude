# Design systems

`broadsheet/` is the Claude Design system the `Separation` component was authored
against, as exported from the design project. It is vendored here because the
published artifact of that component did not carry it, so the page rendered with
every token unset.

Consume it the way its own readme says — link the one stylesheet and take every
colour, font, spacing, radius and shadow from its variables:

    <link rel="stylesheet" href="_ds/broadsheet/styles.css">

`Separation.dc.html` does exactly that. Do not hard-code a hex, a font name or a
px value the tokens already carry; `.adherence.oxlintrc.json` is the lint config
that enforces it.

`print-plates.js` is not vendored separately — it is inlined in `_ds_bundle.js`.
Pages using the `.cmyk` image treatment need one or the other in the document;
nothing here uses it yet.
