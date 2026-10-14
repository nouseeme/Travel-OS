export function PlatformCredit() {
  return (
    <a
      className="platform-credit"
      href="https://github.com/nouseeme/"
      target="_blank"
      rel="noopener noreferrer"
    >
      TravelOS by Noufal Rizka © 2026
    </a>
  );
}

export function PlatformFooter() {
  return (
    <footer className="platform-footer">
      <PlatformCredit />
    </footer>
  );
}
