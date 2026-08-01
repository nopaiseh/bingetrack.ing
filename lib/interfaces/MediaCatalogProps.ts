import { Stats } from "@/lib/interfaces/Stats";
import { Media } from "@/lib/types/Media";

export interface MediaCatalogProps {
  watched?: Media[];
  watching?: Media[];
  want?: Media[];
  stats?: Stats;
}