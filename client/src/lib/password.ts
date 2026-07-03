export const passwordRequirements = [
  {
    id: "length",
    label: "En az 10 karakter",
    test: (password: string) => password.length >= 10,
  },
  {
    id: "uppercase",
    label: "En az 1 büyük harf",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "En az 1 küçük harf",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "En az 1 rakam",
    test: (password: string) => /\d/.test(password),
  },
  {
    id: "special",
    label: "En az 1 özel karakter",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
]

export function isPasswordValid(password: string) {
  return passwordRequirements.every((requirement) => requirement.test(password))
}
