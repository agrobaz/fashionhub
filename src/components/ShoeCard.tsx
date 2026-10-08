import { Link } from "react-router-dom";
import type { Shoe } from "../lib/types";
import { conditionLabel, formatPrice } from "../lib/format";

export default function ShoeCard({ shoe }: { shoe: Shoe }) {
  const isNew = shoe.listing_type === "new";
  const tag = isNew ? "New" : conditionLabel(shoe.condition) || "Used";

  return (
    <Link
      to={"/shoe/" + shoe.id}
      className="card marketplace-card"
      aria-label={"View " + shoe.title}
    >
      <div className="thumb marketplace-thumb">
        {shoe.photo_url ? (
          <img
            src={shoe.photo_url}
            alt={shoe.title}
            loading="lazy"
          />
        ) : (
          <div className="noimg">
            <span className="noimg-mark">SH</span>
            <small>No photo</small>
          </div>
        )}

        <span className={isNew ? "tag tn" : "tag tu"}>
          {tag}
        </span>
      </div>

      <div className="card-body">
        <div className="ctitle" title={shoe.title}>
          {shoe.title}
        </div>

        {shoe.brand && (
          <div className="card-brand">
            {shoe.brand}
          </div>
        )}

        <div className="price">
          {formatPrice(shoe.price)}
        </div>

        <div className="card-meta">
          {shoe.size && (
            <span>Size {shoe.size}</span>
          )}

          {shoe.category && (
            <span>{shoe.category}</span>
          )}

          {shoe.shops?.area && (
            <span>{shoe.shops.area}</span>
          )}
        </div>

        {shoe.shops?.name && (
          <div className="shop-name">
            <span>Store</span>
            {shoe.shops.name}
          </div>
        )}

        <div className="view-listing">
          <span>View listing</span>
          <span aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}