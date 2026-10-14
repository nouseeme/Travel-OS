import { Plane } from "lucide-react";
export function ProductBrand() {
  return (
    <>
      <span className="brand-mark" aria-hidden="true">
        <Plane size={21} />
      </span>
      <b>
        travel<span>OS</span>
      </b>
    </>
  );
}
export function CompanyIdentity({
  large = false,
  logoOnly = false,
}: {
  large?: boolean;
  logoOnly?: boolean;
}) {
  return (
    <div className={"company-identity" + (large ? " large" : "")}>
      <img
        src="/brand/egimu-logo.jpg"
        alt="Egimu Travel logo"
        width={large ? 108 : 56}
        height={large ? 108 : 56}
      />
      {!logoOnly && (
        <div>
          <b>Egimu Travel</b>
          <small>
            {large ? "Ruang kerja operasional perjalanan" : "Team workspace"}
          </small>
        </div>
      )}
    </div>
  );
}
