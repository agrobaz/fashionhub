import { Link } from "react-router-dom";
import { useCart } from "../lib/cart-context";
import { formatPrice } from "../lib/format";

export default function CartPage() {
  const {
    items,
    itemCount,
    subtotal,
    loading,
    error,
    updateQuantity,
    removeItem,
  } = useCart();

  if (loading && items.length === 0) {
    return (
      <main className="page-shell fashion-cart-page">
        <section className="cart-loading">
          <div className="fashion-spinner" />
          <p>Loading your cart...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell fashion-cart-page">
      <section className="cart-header">
        <div>
          <div className="eyebrow">FashionHub cart</div>
          <h1>Your shopping cart</h1>
          <p className="muted">
            {itemCount} {itemCount === 1 ? "item" : "items"} ready for checkout.
          </p>
        </div>

        <Link to="/" className="btn ghost cart-continue">
          Continue shopping
        </Link>
      </section>

      {error && (
        <div className="cart-error">
          <strong>Something went wrong</strong>
          <span>{error}</span>
        </div>
      )}

      {items.length === 0 ? (
        <section className="fashion-empty-cart">
          <div className="empty-cart-mark">FH</div>

          <div className="eyebrow">Your cart</div>
          <h2>Your cart is waiting for you</h2>

          <p className="muted">
            Discover shoes and fashion from FashionHub sellers and add your
            favorites here.
          </p>

          <Link to="/" className="btn gold">
            Browse fashion
          </Link>
        </section>
      ) : (
        <>
          <div className="cart-layout fashion-cart-layout">
            <section className="cart-items">
              <div className="cart-section-heading">
                <div>
                  <span className="eyebrow">Selected items</span>
                  <h2>Your items</h2>
                </div>
                <span className="cart-count-pill">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>

              {items.map((item) => {
                const shoe = item.shoe;

                const maxStock =
                  item.variant_id && shoe
                    ? shoe.stock_quantity
                    : shoe?.stock_quantity ?? item.quantity;

                return (
                  <article className="fashion-cart-item" key={item.id}>
                    <Link
                      to={`/shoe/${item.shoe_id}`}
                      className="fashion-cart-image"
                    >
                      {shoe?.photo_url ? (
                        <img
                          src={shoe.photo_url}
                          alt={shoe.title}
                          loading="lazy"
                        />
                      ) : (
                        <div className="fashion-cart-placeholder">
                          <span>FH</span>
                        </div>
                      )}
                    </Link>

                    <div className="fashion-cart-details">
                      <div className="cart-item-top">
                        <div>
                          <Link
                            to={`/shoe/${item.shoe_id}`}
                            className="fashion-cart-title"
                          >
                            {shoe?.title ?? "Fashion item"}
                          </Link>

                          {shoe?.shops?.name && (
                            <div className="fashion-cart-seller">
                              Sold by {shoe.shops.name}
                            </div>
                          )}
                        </div>

                        <strong className="fashion-cart-line-total">
                          {formatPrice(item.unit_price * item.quantity)}
                        </strong>
                      </div>

                      <div className="fashion-cart-meta">
                        {item.size && (
                          <span>
                            <small>Size</small>
                            {item.size}
                          </span>
                        )}

                        {item.color && (
                          <span>
                            <small>Color</small>
                            {item.color}
                          </span>
                        )}

                        {!item.size && !item.color && (
                          <span>
                            <small>Item</small>
                            FashionHub product
                          </span>
                        )}
                      </div>

                      <div className="fashion-cart-bottom">
                        <div className="fashion-quantity">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            disabled={item.quantity <= 1 || loading}
                            onClick={() =>
                              void updateQuantity(
                                item.id,
                                item.quantity - 1,
                              )
                            }
                          >
                            −
                          </button>

                          <strong>{item.quantity}</strong>

                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={
                              loading ||
                              (maxStock > 0 && item.quantity >= maxStock)
                            }
                            onClick={() =>
                              void updateQuantity(
                                item.id,
                                item.quantity + 1,
                              )
                            }
                          >
                            +
                          </button>
                        </div>

                        <span className="fashion-unit-price">
                          {formatPrice(item.unit_price)} each
                        </span>

                        <button
                          type="button"
                          className="cart-remove"
                          disabled={loading}
                          onClick={() => void removeItem(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="fashion-cart-summary">
              <div className="eyebrow">Order summary</div>
              <h2>Ready to checkout?</h2>

              <div className="fashion-summary-rows">
                <div>
                  <span>Items</span>
                  <strong>{itemCount}</strong>
                </div>

                <div>
                  <span>Subtotal</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>

                <div>
                  <span>Delivery</span>
                  <span className="summary-muted">Calculated at checkout</span>
                </div>
              </div>

              <div className="fashion-cart-total">
                <span>Total</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>

              <Link
                to="/checkout"
                className="btn gold full-width fashion-checkout-button"
              >
                Proceed to checkout
              </Link>

              <div className="fashion-cart-trust">
                <div>
                  <span className="trust-icon">✓</span>
                  <span>
                    <strong>Secure checkout</strong>
                    <small>Your order is protected.</small>
                  </span>
                </div>

                <div>
                  <span className="trust-icon">₵</span>
                  <span>
                    <strong>Flexible payment</strong>
                    <small>Mobile money and other options.</small>
                  </span>
                </div>
              </div>

              <p className="fashion-cart-note">
                Delivery charges and available payment methods are confirmed
                during checkout.
              </p>
            </aside>
          </div>

          <div className="mobile-cart-checkout">
            <div>
              <span>Total</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>

            <Link to="/checkout" className="btn gold">
              Checkout
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
