import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);

/*
 * The customer's cart. An order belongs to ONE supplier, so the cart does too:
 * choosing a different supplier starts a new cart.
 */
export const CartProvider = ({ children }) => {
  const [supplier, setSupplierState] = useState(null); // { id, name }
  const [lines, setLines] = useState({}); // productId -> { product, qty }

  const count = useMemo(
    () => Object.values(lines).reduce((sum, l) => sum + l.qty, 0),
    [lines]
  );
  const totalPaise = useMemo(
    () => Object.values(lines).reduce((sum, l) => sum + (Number(l.product.unitPricePaise) || 0) * l.qty, 0),
    [lines]
  );

  const setSupplier = useCallback((next) => {
    setSupplierState((current) => {
      if (!current || current.id !== next.id) setLines({});
      return { id: next.id, name: next.name };
    });
  }, []);

  const setQty = useCallback((product, qty) => {
    setLines((previous) => {
      const next = { ...previous };
      if (qty <= 0) delete next[product.id];
      else next[product.id] = { product, qty: Math.min(qty, 100) };
      return next;
    });
  }, []);

  const qtyOf = useCallback((productId) => lines[productId]?.qty || 0, [lines]);

  const clear = useCallback(() => setLines({}), []);

  const value = useMemo(
    () => ({ supplier, lines, count, totalPaise, setSupplier, setQty, qtyOf, clear }),
    [supplier, lines, count, totalPaise, setSupplier, setQty, qtyOf, clear]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
