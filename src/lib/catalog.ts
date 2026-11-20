export const COLLECTIONS = [
  { kind: "company", id: 420, name: "Marvel Studios", note: "Studio" },
  { kind: "company", id: 2, name: "Walt Disney Pictures", note: "Studio" },
  { kind: "company", id: 3, name: "Pixar", note: "Studio" },
  { kind: "company", id: 9993, name: "DC", note: "Studio" },
  { kind: "company", id: 1, name: "Lucasfilm", note: "Studio" },
  { kind: "company", id: 521, name: "DreamWorks Animation", note: "Studio" },
  { kind: "company", id: 10342, name: "Studio Ghibli", note: "Studio" },
  { kind: "collection", id: 10194, name: "Toy Story", note: "Collection" },
  { kind: "collection", id: 1241, name: "Harry Potter", note: "Collection" },
  { kind: "collection", id: 10, name: "Star Wars", note: "Collection" },
  { kind: "collection", id: 119, name: "The Lord of the Rings", note: "Collection" },
  { kind: "collection", id: 9485, name: "Fast & Furious", note: "Collection" },
  { kind: "collection", id: 86311, name: "The Avengers", note: "Collection" },
  { kind: "collection", id: 645, name: "James Bond 007", note: "Collection" },
  { kind: "collection", id: 263, name: "The Dark Knight", note: "Collection" },
  { kind: "collection", id: 87359, name: "Mission: Impossible", note: "Collection" },
  { kind: "collection", id: 2150, name: "Shrek", note: "Collection" },
  { kind: "collection", id: 328, name: "Jurassic Park", note: "Collection" },
] as const;

export interface NetworkCatalogItem {
  id: number;
  name: string;
  country: string;
  companyId?: number;
}

export const NETWORKS: readonly NetworkCatalogItem[] = [
  { id: 213, name: "Netflix", country: "US", companyId: 178464 },
  { id: 49, name: "HBO", country: "US", companyId: 7429 },
  { id: 1024, name: "Prime Video", country: "US", companyId: 20580 },
  { id: 2739, name: "Disney+", country: "US", companyId: 2 },
  { id: 2552, name: "Apple TV+", country: "US" },
  { id: 453, name: "Hulu", country: "US" },
  { id: 4330, name: "Paramount+", country: "US" },
  { id: 6, name: "NBC", country: "US" },
  { id: 2, name: "ABC", country: "US" },
  { id: 16, name: "CBS", country: "US" },
  { id: 19, name: "FOX", country: "US" },
  { id: 71, name: "The CW", country: "US" },
  { id: 88, name: "FX", country: "US" },
  { id: 174, name: "AMC", country: "US" },
  { id: 67, name: "Showtime", country: "US" },
  { id: 318, name: "Starz", country: "US" },
  { id: 56, name: "Cartoon Network", country: "US" },
  { id: 13, name: "Nickelodeon", country: "US" },
  { id: 80, name: "Adult Swim", country: "US" },
  { id: 47, name: "Comedy Central", country: "US" },
  { id: 43, name: "National Geographic", country: "US" },
  { id: 64, name: "Discovery", country: "US" },
  { id: 4, name: "BBC One", country: "GB" },
  { id: 332, name: "BBC Two", country: "GB" },
  { id: 9, name: "ITV", country: "GB" },
  { id: 26, name: "Channel 4", country: "GB" },
  { id: 1, name: "Fuji TV", country: "JP" },
  { id: 57, name: "Nippon TV", country: "JP" },
  { id: 103, name: "TV Asahi", country: "JP" },
  { id: 614, name: "Tokyo MX", country: "JP" },
  { id: 342, name: "KBS2", country: "KR" },
  { id: 885, name: "JTBC", country: "KR" },
  { id: 627, name: "OCN", country: "KR" },
  { id: 11, name: "SBS", country: "KR" },
  { id: 97, name: "MBC", country: "KR" },
  { id: 866, name: "tvN", country: "KR" },
  { id: 1330, name: "iQIYI", country: "CN" },
  { id: 2007, name: "Tencent Video", country: "CN" },
] as const;

export const COUNTRIES = [
  { code: "ID", name: "Indonesia" },
  { code: "US", name: "United States" },
  { code: "KR", name: "South Korea" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "TH", name: "Thailand" },
  { code: "IN", name: "India" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "PH", name: "Philippines" },
  { code: "MY", name: "Malaysia" },
  { code: "TR", name: "Turkey" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "HK", name: "Hong Kong" },
];

export const YEARS = Array.from(
  { length: new Date().getFullYear() - 1969 },
  (_, i) => new Date().getFullYear() - i,
);
