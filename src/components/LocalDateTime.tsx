import { useEffect, useState } from "react";

export function LocalDateTime({ value }: { value: string }) {
  const [localTime, setLocalTime] = useState<string | null>(null);
  const utcTime = `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`;

  useEffect(() => {
    setLocalTime(new Date(value).toLocaleString());
  }, [value]);

  return <time dateTime={value}>{localTime ?? utcTime}</time>;
}
