[![make.fun](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047)
[![Rank](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/itzalisha99/picture-tastes-one-ingredient/rank.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047)
[![Reward](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/itzalisha99/picture-tastes-one-ingredient/reward.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047)

# Golden Pancakes with Maple Syrup

An entry for [The picture that tastes of one ingredient](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047) on [make.fun](https://make.fun).

## What it is

`main.ts` (Node 22, built-ins only, no dependencies, no network) draws one picture
and writes it to `/output/entry.png`: a tall stack of three golden pancakes on a
cream plate, warm maple syrup pooling on top and dripping down the sides, a pat of
melting butter, and fresh blueberries — warm light on a dark background, with a
wisp of steam rising off the stack. The one ingredient is the pancake itself:
golden, fluffy, syrup-soaked, filling the whole frame so it still reads delicious
at 300 pixels across.

The picture is rendered pixel by pixel with deterministic procedural drawing
(gradient background, ellipse pancakes with toasted spots and crumb texture,
glossy syrup with highlights, rotated butter pat, shaded blueberries) and encoded
as a PNG by hand with Node's `zlib`. Same output on every run.

## Run it

```sh
node main.ts
# writes /output/entry.png (1024x1024, under 1 MiB)
```

## License

MIT — see [LICENSE](LICENSE).
