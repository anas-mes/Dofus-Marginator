import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "dofus-margin-react-v3";

const keyOf = (name) => (name || "").trim().toLowerCase();
const formatNumber = (value, digits = 0) =>
  value.toLocaleString("fr-FR", { maximumFractionDigits: digits });
const formatKamas = (value, digits = 0) => `${formatNumber(value, digits)} k`;

const createRecipe = () => ({
  name: "Nouvelle recette",
  sell: 0,
  sellLot: 1,
  out: 1,
  ings: [{ n: "", q: 1 }],
});

const createArdoniteRecipe = () => ({
  ...createRecipe(),
  name: "Ardonite",
  ings: [
    ["Fer", 10],
    ["Argent", 10],
    ["Obsidienne", 10],
    ["Bauxite", 10],
    ["Étain", 5],
    ["Cendrepierre", 5],
    ["Dolomite", 5],
    ["Silicate", 5],
  ].map(([name, quantity]) => ({ n: name, q: quantity })),
});

const createInitialState = () => ({
  tax: 2,
  n: 100,
  prices: {},
  recipes: [createArdoniteRecipe()],
});

function loadSavedState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return createInitialState();

    const state = JSON.parse(saved);
    if (state && Array.isArray(state.recipes) && state.recipes.length > 0) {
      return state;
    }

    console.warn("Saved Dofus calculator data is invalid; using the default recipe.");
  } catch (error) {
    console.error("Could not load saved Dofus calculator data.", error);
  }

  return createInitialState();
}

function NumberInput({ value, onChange, ...props }) {
  return (
    <input
      type="number"
      min="0"
      step="any"
      placeholder="0"
      value={value || ""}
      onChange={(event) => onChange(Number.parseFloat(event.target.value) || 0)}
      {...props}
    />
  );
}

function LotSelect({ value, onChange }) {
  return (
    <select value={value || 1} onChange={(event) => onChange(Number(event.target.value))}>
      {[1, 10, 100].map((lot) => (
        <option key={lot} value={lot}>
          {lot === 1 ? "× 1" : `× ${lot}`}
        </option>
      ))}
    </select>
  );
}

function calculateRecipe(recipe, prices, tax, craftCount) {
  const unitPrice = (name) => {
    const price = prices[keyOf(name)];
    return price && price.p ? price.p / (price.lot || 1) : 0;
  };
  const lines = recipe.ings.map((ingredient) => ({
    ...ingredient,
    u: unitPrice(ingredient.n),
    c: unitPrice(ingredient.n) * ingredient.q,
  }));
  const cost = lines.reduce((total, line) => total + line.c, 0);
  const output = Math.max(1, recipe.out || 1);
  const revenue = (recipe.sell / (recipe.sellLot || 1)) * output;
  const margin = revenue * (1 - tax / 100) - cost;

  return {
    lines,
    cost,
    rev: revenue,
    m: margin,
    pct: cost > 0 ? (margin / cost) * 100 : 0,
    mN: margin * craftCount,
    out: output,
    minSell: cost / (output * (1 - tax / 100)),
  };
}

function Kpi({ label, cost, revenue, tax, multiplier }) {
  const margin = revenue * (1 - tax / 100) - cost;
  const percentage = cost > 0 ? (margin / cost) * 100 : 0;
  const resultClass = margin >= 0 ? "pos" : "neg";

  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className={`v ${resultClass}`}>
        {margin >= 0 ? "+" : ""}
        {formatKamas(margin * multiplier)}
      </div>
      <div className="s">
        <span>Coût {formatKamas(cost * multiplier)}</span>
        <span>Vente {formatKamas(revenue * multiplier)}</span>
      </div>
      <div className="s tax-row">
        <span>Taxe −{formatKamas((revenue * multiplier * tax) / 100)}</span>
        <span className={`pill ${resultClass}`}>
          {percentage >= 0 ? "+" : ""}
          {formatNumber(percentage, 1)} %
        </span>
      </div>
    </div>
  );
}

function Recipe({ recipe, state, craftCount, update, remove, duplicate }) {
  const result = calculateRecipe(recipe, state.prices, state.tax, craftCount);
  const setIngredient = (index, patch) =>
    update({
      ings: recipe.ings.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, ...patch } : ingredient,
      ),
    });

  return (
    <div className="card">
      <div className="rh">
        <input
          value={recipe.name}
          onChange={(event) => update({ name: event.target.value })}
          aria-label="Nom de la recette"
        />
        <button className="ico" title="Dupliquer" aria-label="Dupliquer la recette" onClick={duplicate}>
          ⧉
        </button>
        <button className="ico del" title="Supprimer" aria-label="Supprimer la recette" onClick={remove}>
          ✕
        </button>
      </div>

      <div className="f2">
        <div>
          <label>Prix de vente</label>
          <div className="pl">
            <NumberInput value={recipe.sell} onChange={(value) => update({ sell: value })} />
            <LotSelect
              value={recipe.sellLot}
              onChange={(value) => update({ sellLot: value })}
            />
          </div>
        </div>
        <div>
          <label>Produits par craft</label>
          <NumberInput value={recipe.out} onChange={(value) => update({ out: value || 1 })} />
        </div>
      </div>

      <div className="ing h">
        <span>Ingrédient</span>
        <span className="r">Qté</span>
        <span className="r u">Prix/u</span>
        <span className="r">Coût</span>
        <span />
      </div>
      {result.lines.map((line, index) => (
        <div className="ing" key={index}>
          <input
            list="res"
            placeholder="Ressource"
            value={line.n}
            onChange={(event) => setIngredient(index, { n: event.target.value })}
          />
          <NumberInput value={line.q} onChange={(value) => setIngredient(index, { q: value })} />
          <span className="r u">{formatKamas(line.u, 2)}</span>
          <span className="r">
            <b>{formatKamas(line.c)}</b>
          </span>
          <button
            className="ico del"
            aria-label={`Supprimer ${line.n || "cet ingrédient"}`}
            onClick={() =>
              update({ ings: recipe.ings.filter((_, ingredientIndex) => ingredientIndex !== index) })
            }
          >
            ✕
          </button>
        </div>
      ))}
      <button onClick={() => update({ ings: [...recipe.ings, { n: "", q: 1 }] })}>
        + Ingrédient
      </button>

      <div className="kpis">
        <Kpi label="1 craft" cost={result.cost} revenue={result.rev} tax={state.tax} multiplier={1} />
        <Kpi
          label={`Lot de ${craftCount}`}
          cost={result.cost}
          revenue={result.rev}
          tax={state.tax}
          multiplier={craftCount}
        />
      </div>
      <div className="min">
        <span>Prix de vente minimum (unité)</span>
        <b>{formatKamas(result.minSell, 1)}</b>
      </div>

      <details>
        <summary>Liste d’achat pour {craftCount} crafts</summary>
        <table>
          <thead>
            <tr>
              <th>Ressource</th>
              <th>Quantité</th>
              <th>Coût</th>
            </tr>
          </thead>
          <tbody>
            {result.lines
              .filter((line) => keyOf(line.n))
              .map((line, index) => (
                <tr key={`${keyOf(line.n)}-${index}`}>
                  <td>{line.n}</td>
                  <td>{formatNumber(line.q * craftCount)}</td>
                  <td>{formatKamas(line.c * craftCount)}</td>
                </tr>
              ))}
            <tr>
              <td>
                <b>Total</b>
              </td>
              <td />
              <td>
                <b>{formatKamas(result.cost * craftCount)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}

function App() {
  const [state, setState] = useState(loadSavedState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Could not save Dofus calculator data.", error);
    }
  }, [state]);

  const craftCount = Math.max(1, Math.floor(state.n) || 1);
  const updateState = (patch) => setState((current) => ({ ...current, ...patch }));
  const updateRecipe = (index) => (patch) =>
    setState((current) => ({
      ...current,
      recipes: current.recipes.map((recipe, recipeIndex) =>
        recipeIndex === index ? { ...recipe, ...patch } : recipe,
      ),
    }));
  const updatePrice = (key, patch) =>
    setState((current) => ({
      ...current,
      prices: {
        ...current.prices,
        [key]: { p: 0, lot: 1, ...current.prices[key], ...patch },
      },
    }));
  const usedResources = useMemo(() => {
    const resources = new Map();
    state.recipes.forEach((recipe) =>
      recipe.ings.forEach((ingredient) => {
        const key = keyOf(ingredient.n);
        if (key && !resources.has(key)) resources.set(key, ingredient.n.trim());
      }),
    );
    return [...resources];
  }, [state.recipes]);
  const ranking = state.recipes
    .map((recipe) => ({
      recipe,
      result: calculateRecipe(recipe, state.prices, state.tax, craftCount),
    }))
    .sort((a, b) => b.result.mN - a.result.mN);
  const maxMargin = Math.max(1, ...ranking.map(({ result }) => Math.abs(result.mN)));

  return (
    <div>
      <div className="top">
        <div>
          <h1>⚒ Dofus Craft Margin</h1>
          <div className="tag">Calcule la rentabilité de tes crafts, à l’unité ou par lot.</div>
        </div>
        <div className="ctrl">
          <div>
            <label>Taxe HDV %</label>
            <NumberInput value={state.tax} onChange={(value) => updateState({ tax: value })} />
          </div>
          <div>
            <label>Crafts (lot)</label>
            <NumberInput value={state.n} onChange={(value) => updateState({ n: value })} />
          </div>
        </div>
      </div>

      <datalist id="res">
        {usedResources.map(([key, name]) => (
          <option key={key} value={name} />
        ))}
      </datalist>

      <div className="layout">
        <div className="recs">
          {state.recipes.map((recipe, index) => (
            <Recipe
              key={index}
              recipe={recipe}
              state={state}
              craftCount={craftCount}
              update={updateRecipe(index)}
              remove={() => {
                if (window.confirm("Supprimer cette recette ?")) {
                  updateState({
                    recipes: state.recipes.filter((_, recipeIndex) => recipeIndex !== index),
                  });
                }
              }}
              duplicate={() =>
                updateState({
                  recipes: [
                    ...state.recipes.slice(0, index + 1),
                    { ...JSON.parse(JSON.stringify(recipe)), name: `${recipe.name} (copie)` },
                    ...state.recipes.slice(index + 1),
                  ],
                })
              }
            />
          ))}
          <button
            className="gold"
            onClick={() => updateState({ recipes: [...state.recipes, createRecipe()] })}
          >
            + Nouvelle recette
          </button>
        </div>

        <div className="side">
          <div className="card">
            <h2>Classement · lot de {craftCount}</h2>
            <div className="rk">
              {ranking.map(({ recipe, result }, index) => (
                <div key={index}>
                  <div className="n">
                    <span>{index === 0 && result.mN > 0 ? "👑 " : ""}{recipe.name}</span>
                    <b className={result.mN >= 0 ? "pos" : "neg"}>
                      {result.mN >= 0 ? "+" : ""}
                      {formatKamas(result.mN)}
                    </b>
                  </div>
                  <div className="bar">
                    <i
                      style={{
                        width: `${(Math.abs(result.mN) / maxMargin) * 100}%`,
                        background: result.mN >= 0 ? "var(--pos)" : "var(--neg)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Prix des ressources</h2>
            <div className="muted resource-hint">
              Un seul prix par ressource, partagé entre toutes les recettes.
            </div>
            {usedResources.length ? (
              usedResources.map(([key, name]) => {
                const price = state.prices[key] || { p: 0, lot: 1 };
                return (
                  <div className="pr" key={key}>
                    <span>{name}</span>
                    <NumberInput value={price.p} onChange={(value) => updatePrice(key, { p: value })} />
                    <LotSelect
                      value={price.lot}
                      onChange={(value) => updatePrice(key, { lot: value })}
                    />
                  </div>
                );
              })
            ) : (
              <div className="muted">Ajoute des ingrédients.</div>
            )}
            <button className="reset-prices" onClick={() => updateState({ prices: {} })}>
              Remettre à zéro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
