export interface Scene {
  id: number;
  text: string;
  image: string;
  duration: number;
}

export interface ScenePlan {
  title: string;
  scenes: Scene[];
}
