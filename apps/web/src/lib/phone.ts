export const normaliseIndianMobile = (input: string): string | null => {
  const digits = input.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return `91${local}`;
};

export const formatIndianMobile = (e164: string): string => {
  const local = e164.replace(/^\+?91/, "");
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
};
