export interface Topic {
  name: string
  grid: string[][]
}

export const ROWS = ['A', 'B', 'C', 'D']
export const COLS = ['1', '2', '3', '4']

export function getRandomCode(): string {
  const row = Math.floor(Math.random() * 4)
  const col = Math.floor(Math.random() * 4)
  return `${ROWS[row]}${COLS[col]}`
}

export function getWordFromCode(grid: string[][], code: string): string {
  const row = ROWS.indexOf(code[0])
  const col = parseInt(code[1]) - 1
  if (row === -1 || col < 0) return ''
  return grid[row]?.[col] || ''
}

export function flattenGrid(grid: string[][]): Record<string, string> {
  const flat: Record<string, string> = {}
  ROWS.forEach((row, ri) => {
    COLS.forEach((col, ci) => {
      flat[`${row}${col}`] = grid[ri][ci]
    })
  })
  return flat
}

export function unflattenGrid(flat: Record<string, string>): string[][] {
  return ROWS.map(row => COLS.map(col => flat[`${row}${col}`] || ''))
}

export const TOPICS: Topic[] = [
  {
    name: 'Animals',
    grid: [
      ['Lion', 'Tiger', 'Elephant', 'Giraffe'],
      ['Zebra', 'Cheetah', 'Gorilla', 'Hippo'],
      ['Crocodile', 'Penguin', 'Dolphin', 'Eagle'],
      ['Wolf', 'Bear', 'Shark', 'Parrot'],
    ],
  },
  {
    name: 'Countries',
    grid: [
      ['Brazil', 'Japan', 'Germany', 'India'],
      ['France', 'Canada', 'Egypt', 'Mexico'],
      ['Russia', 'Australia', 'Italy', 'China'],
      ['Spain', 'Argentina', 'Nigeria', 'Sweden'],
    ],
  },
  {
    name: 'Sports',
    grid: [
      ['Football', 'Cricket', 'Tennis', 'Basketball'],
      ['Swimming', 'Boxing', 'Chess', 'Cycling'],
      ['Golf', 'Rugby', 'Volleyball', 'Baseball'],
      ['Skiing', 'Archery', 'Badminton', 'Wrestling'],
    ],
  },
  {
    name: 'Movies',
    grid: [
      ['Inception', 'Titanic', 'Avatar', 'Joker'],
      ['Interstellar', 'Parasite', 'Frozen', 'Gladiator'],
      ['Matrix', 'Jaws', 'Alien', 'Coco'],
      ['Dune', 'Oppenheimer', 'Barbie', 'Gravity'],
    ],
  },
  {
    name: 'Food',
    grid: [
      ['Pizza', 'Sushi', 'Tacos', 'Burger'],
      ['Pasta', 'Curry', 'Ramen', 'Biryani'],
      ['Steak', 'Salad', 'Waffles', 'Kebab'],
      ['Dumplings', 'Paella', 'Pho', 'Falafel'],
    ],
  },
  {
    name: 'Superheroes',
    grid: [
      ['Batman', 'Superman', 'Spiderman', 'Ironman'],
      ['Thor', 'Hulk', 'Wolverine', 'Flash'],
      ['Wonder Woman', 'Aquaman', 'Black Panther', 'Deadpool'],
      ['Captain America', 'Doctor Strange', 'Shazam', 'Green Arrow'],
    ],
  },
  {
    name: 'Music',
    grid: [
      ['Rock', 'Jazz', 'Pop', 'Classical'],
      ['Hip-Hop', 'R&B', 'Country', 'Electronic'],
      ['Reggae', 'Metal', 'Blues', 'Folk'],
      ['Disco', 'Punk', 'Gospel', 'Indie'],
    ],
  },
  {
    name: 'Professions',
    grid: [
      ['Doctor', 'Lawyer', 'Engineer', 'Teacher'],
      ['Chef', 'Pilot', 'Artist', 'Scientist'],
      ['Soldier', 'Nurse', 'Architect', 'Journalist'],
      ['Astronaut', 'Farmer', 'Detective', 'Musician'],
    ],
  },
  {
    name: 'Places',
    grid: [
      ['Beach', 'Mountain', 'Desert', 'Forest'],
      ['City', 'Village', 'Island', 'Jungle'],
      ['Cave', 'Castle', 'Airport', 'Stadium'],
      ['Museum', 'Hospital', 'Library', 'Volcano'],
    ],
  },
  {
    name: 'Vehicles',
    grid: [
      ['Car', 'Bicycle', 'Airplane', 'Boat'],
      ['Train', 'Helicopter', 'Motorcycle', 'Bus'],
      ['Submarine', 'Truck', 'Rocket', 'Scooter'],
      ['Tank', 'Cable Car', 'Hovercraft', 'Jet Ski'],
    ],
  },
]
