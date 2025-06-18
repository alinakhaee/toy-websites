import React, { useState, useEffect, useCallback } from 'react';

// Types
interface Cell {
  x: number;
  y: number;
  isRevealed: boolean;
  building: Building | null;
  terrain: 'grass' | 'forest' | 'mountain' | 'water';
  resources: number;
  adjacencyBonus: number;
}

interface Building {
  type: 'castle' | 'house' | 'farm' | 'mine' | 'barracks' | 'tower' | 'market';
  level: number;
  owner: 'player' | 'enemy';
  income: number;
  adjacencyBonuses: string[];
}

interface ResourceChange {
  gold: number;
  population: number;
  food: number;
  military: number;
}

interface TurnEvent {
  type: 'building_built' | 'resource_bonus' | 'population_growth' | 'military_training' | 'trade_success' | 'weather_effect' | 'resource_discovery' | 'bandit_attack' | 'seasonal_change' | 'achievement';
  message: string;
  icon: string;
  severity?: 'positive' | 'negative' | 'neutral';
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  reward?: string;
}

interface ParticleEffect {
  id: string;
  x: number;
  y: number;
  type: 'sparkle' | 'coin' | 'build' | 'victory';
  duration: number;
  startTime: number;
}

interface Season {
  name: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
  icon: string;
  colors: {
    primary: string;
    secondary: string;
    terrain: Record<string, string>;
  };
  effects: {
    goldBonus: number;
    foodBonus: number;
    militaryBonus: number;
  };
}

interface GameState {
  grid: Cell[][];
  turn: number;
  timeOfDay: 'day' | 'night';
  isTransitioning: boolean;
  player: {
    gold: number;
    population: number;
    army: number;
    food: number;
    militaryStrength: number;
  };
  selectedCell: { x: number; y: number } | null;
  gamePhase: 'placement' | 'battle' | 'victory';
  resourceChanges: ResourceChange;
  lastTurnIncome: ResourceChange;
  turnEvents: TurnEvent[];
  showTurnSummary: boolean;
  showEndTurnConfirm: boolean;
  // New game progression features
  territoryControlPercentage: number;
  currentSeason: Season;
  achievements: Achievement[];
  particleEffects: ParticleEffect[];
  gameWon: boolean;
  victoryType?: 'territory' | 'resources' | 'buildings';
  showVictoryScreen: boolean;
  isLoading: boolean;
}

interface DragState {
  isDragging: boolean;
  draggedBuilding: Building['type'] | null;
  dragOverCell: { x: number; y: number } | null;
}

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

const GRID_SIZE = 12;

// Seasons system
const SEASONS: Season[] = [
  {
    name: 'Spring',
    icon: '🌸',
    colors: {
      primary: 'from-green-400 to-emerald-500',
      secondary: 'from-pink-300 to-rose-400',
      terrain: {
        grass: 'from-green-300 to-green-400',
        forest: 'from-green-500 to-green-600',
        mountain: 'from-slate-400 to-slate-500',
        water: 'from-blue-400 to-cyan-500'
      }
    },
    effects: { goldBonus: 0.1, foodBonus: 0.2, militaryBonus: 0 }
  },
  {
    name: 'Summer',
    icon: '☀️',
    colors: {
      primary: 'from-yellow-400 to-orange-500',
      secondary: 'from-amber-300 to-yellow-400',
      terrain: {
        grass: 'from-yellow-300 to-green-400',
        forest: 'from-green-400 to-green-500',
        mountain: 'from-orange-400 to-red-500',
        water: 'from-blue-500 to-blue-600'
      }
    },
    effects: { goldBonus: 0.2, foodBonus: 0.3, militaryBonus: 0.1 }
  },
  {
    name: 'Autumn',
    icon: '🍂',
    colors: {
      primary: 'from-orange-400 to-red-500',
      secondary: 'from-amber-400 to-orange-500',
      terrain: {
        grass: 'from-orange-300 to-red-400',
        forest: 'from-orange-500 to-red-600',
        mountain: 'from-slate-500 to-slate-600',
        water: 'from-blue-600 to-indigo-600'
      }
    },
    effects: { goldBonus: 0.3, foodBonus: 0.1, militaryBonus: 0.2 }
  },
  {
    name: 'Winter',
    icon: '❄️',
    colors: {
      primary: 'from-blue-400 to-cyan-500',
      secondary: 'from-slate-300 to-blue-400',
      terrain: {
        grass: 'from-blue-200 to-cyan-300',
        forest: 'from-blue-600 to-indigo-700',
        mountain: 'from-slate-600 to-slate-700',
        water: 'from-blue-800 to-indigo-900'
      }
    },
    effects: { goldBonus: 0, foodBonus: -0.1, militaryBonus: 0.3 }
  }
];

// Achievements system
const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_building',
    name: 'Foundation',
    description: 'Build your first structure',
    icon: '🏗️',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    reward: 'Unlock: Market building'
  },
  {
    id: 'gold_collector',
    name: 'Gold Rush',
    description: 'Accumulate 1000 gold',
    icon: '💰',
    unlocked: false,
    progress: 0,
    maxProgress: 1000,
    reward: '+10% gold income'
  },
  {
    id: 'empire_builder',
    name: 'Empire Builder',
    description: 'Control 25% of the territory',
    icon: '🏰',
    unlocked: false,
    progress: 0,
    maxProgress: 25,
    reward: 'Unlock: Advanced buildings'
  },
  {
    id: 'all_buildings',
    name: 'Master Architect',
    description: 'Build all building types',
    icon: '🏛️',
    unlocked: false,
    progress: 0,
    maxProgress: 7,
    reward: 'Victory condition unlocked'
  },
  {
    id: 'population_boom',
    name: 'Population Boom',
    description: 'Reach 100 population',
    icon: '👥',
    unlocked: false,
    progress: 0,
    maxProgress: 100,
    reward: '+20% population growth'
  }
];

// Building costs and consumption
const BUILDING_COSTS = {
  house: { gold: 50, food: 5, population: 0 },
  farm: { gold: 75, food: 0, population: 2 },
  mine: { gold: 100, food: 10, population: 3 },
  barracks: { gold: 150, food: 15, population: 5 },
  tower: { gold: 200, food: 20, population: 3 },
  market: { gold: 120, food: 8, population: 4 },
};

// Building resource production/consumption per turn
const BUILDING_EFFECTS = {
  castle: { 
    produces: { gold: 20, population: 2, food: 0, military: 5 },
    consumes: { gold: 0, population: 0, food: 5, military: 0 }
  },
  house: { 
    produces: { gold: 5, population: 3, food: 0, military: 0 },
    consumes: { gold: 0, population: 0, food: 2, military: 0 }
  },
  farm: { 
    produces: { gold: 10, population: 0, food: 20, military: 0 },
    consumes: { gold: 2, population: 1, food: 0, military: 0 }
  },
  mine: { 
    produces: { gold: 30, population: 0, food: 0, military: 0 },
    consumes: { gold: 0, population: 2, food: 8, military: 0 }
  },
  barracks: { 
    produces: { gold: 0, population: 0, food: 0, military: 8 },
    consumes: { gold: 10, population: 3, food: 15, military: 0 }
  },
  tower: { 
    produces: { gold: 0, population: 0, food: 0, military: 12 },
    consumes: { gold: 5, population: 1, food: 8, military: 0 }
  },
  market: { 
    produces: { gold: 25, population: 1, food: 0, military: 0 },
    consumes: { gold: 0, population: 2, food: 5, military: 0 }
  }
};

const BUILDING_ICONS = {
  castle: '🏰',
  house: '🏠',
  farm: '🌾',
  mine: '⛏️',
  barracks: '🛡️',
  tower: '🗼',
  market: '🏪',
};

const TERRAIN_COLORS = {
  grass: 'from-emerald-400 to-emerald-500',
  forest: 'from-emerald-600 to-emerald-700', 
  mountain: 'from-slate-500 to-slate-600',
  water: 'from-blue-500 to-blue-600',
};

const TERRAIN_COLORS_NIGHT = {
  grass: 'from-emerald-800 to-emerald-900',
  forest: 'from-emerald-900 to-slate-900',
  mountain: 'from-slate-700 to-slate-900', 
  water: 'from-blue-900 to-indigo-900',
};

// Building placement rules
const PLACEMENT_RULES = {
  castle: {
    validTerrain: ['grass', 'mountain'],
    maxDistance: 10,
    minDistance: 0,
    description: 'Your main stronghold'
  },
  house: {
    validTerrain: ['grass', 'forest'],
    maxDistance: 3,
    minDistance: 0,
    description: 'Must be near castle or other houses'
  },
  farm: {
    validTerrain: ['grass'],
    maxDistance: 5,
    minDistance: 1,
    description: 'Requires grass terrain, not too close to other buildings'
  },
  mine: {
    validTerrain: ['mountain', 'forest'],
    maxDistance: 10,
    minDistance: 0,
    description: 'Requires mountain or forest terrain'
  },
  barracks: {
    validTerrain: ['grass', 'mountain'],
    maxDistance: 4,
    minDistance: 2,
    description: 'Needs strategic positioning away from houses'
  },
  tower: {
    validTerrain: ['grass', 'mountain'],
    maxDistance: 6,
    minDistance: 1,
    description: 'Defensive positioning on elevated terrain'
  },
  market: {
    validTerrain: ['grass'],
    maxDistance: 3,
    minDistance: 1,
    description: 'Needs access roads, near houses but not farms'
  }
};

// Adjacency bonuses
const ADJACENCY_BONUSES = {
  castle: { house: 10, barracks: 15, tower: 20 },
  house: { house: 5, market: 10, castle: 15 },
  farm: { house: 5, market: 15, farm: -5 },
  mine: { market: 10, barracks: 5 },
  barracks: { tower: 15, castle: 10, barracks: 10 },
  tower: { barracks: 10, tower: 5, castle: 20 },
  market: { house: 10, farm: 15, market: -10 }
};

// Animated Counter Component
const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ 
  value, 
  duration = 800, 
  className = '', 
  prefix = '', 
  suffix = '' 
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);

  useEffect(() => {
    if (value !== previousValue) {
      const startValue = previousValue;
      const endValue = value;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (endValue - startValue) * easeOutCubic);
        
        setDisplayValue(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
      setPreviousValue(value);
    }
  }, [value, previousValue, duration]);

  const isIncreasing = value > previousValue;
  const isDecreasing = value < previousValue;

  return (
    <span className={`${className} transition-all duration-300 ${
      isIncreasing ? 'text-green-400' : isDecreasing ? 'text-red-400' : ''
    }`}>
      {prefix}{displayValue}{suffix}
    </span>
  );
};

function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    // Initialize grid
    const grid: Cell[][] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      grid[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const terrainRand = Math.random();
        let terrain: Cell['terrain'] = 'grass';
        if (terrainRand < 0.1) terrain = 'water';
        else if (terrainRand < 0.3) terrain = 'forest';
        else if (terrainRand < 0.4) terrain = 'mountain';

        grid[y][x] = {
          x,
          y,
          isRevealed: false,
          building: null,
          terrain,
          resources: Math.floor(Math.random() * 20) + 10,
          adjacencyBonus: 0,
        };
      }
    }

    // Place player castle in center and reveal 3x3 area
    const centerX = Math.floor(GRID_SIZE / 2);
    const centerY = Math.floor(GRID_SIZE / 2);
    grid[centerY][centerX].building = { 
      type: 'castle', 
      level: 1, 
      owner: 'player',
      income: 20,
      adjacencyBonuses: []
    };
    
    // Reveal 3x3 area around castle
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const newX = centerX + dx;
        const newY = centerY + dy;
        if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
          grid[newY][newX].isRevealed = true;
        }
      }
    }

    return {
      grid,
      turn: 1,
      timeOfDay: 'day',
      isTransitioning: false,
      player: { 
        gold: 300, 
        population: 10, 
        army: 5, 
        food: 50,
        militaryStrength: 5
      },
      selectedCell: null,
      gamePhase: 'placement',
      resourceChanges: { gold: 0, population: 0, food: 0, military: 0 },
      lastTurnIncome: { gold: 0, population: 0, food: 0, military: 0 },
      turnEvents: [],
      showTurnSummary: false,
      showEndTurnConfirm: false,
      // Game progression features
      territoryControlPercentage: Math.round((9 / (GRID_SIZE * GRID_SIZE)) * 100), // 3x3 revealed area
      currentSeason: SEASONS[0], // Start with Spring
      achievements: [...INITIAL_ACHIEVEMENTS],
      particleEffects: [],
      gameWon: false,
      victoryType: undefined,
      showVictoryScreen: false,
      isLoading: false,
    };
  });

  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedBuilding: null,
    dragOverCell: null,
  });

  const [placingBuilding, setPlacingBuilding] = useState<Building['type'] | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(false);
  const [gridZoom, setGridZoom] = useState(1);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const toggleMinimap = () => setIsMinimapOpen(!isMinimapOpen);
  const zoomIn = () => setGridZoom(prev => Math.min(prev + 0.2, 2));
  const zoomOut = () => setGridZoom(prev => Math.max(prev - 0.2, 0.6));

  const isNight = gameState.timeOfDay === 'night';

  const getBaseIncome = (buildingType: Building['type']): number => {
    const effects = BUILDING_EFFECTS[buildingType];
    return effects.produces.gold;
  };

  // Particle effects system
  const addParticleEffect = useCallback((x: number, y: number, type: ParticleEffect['type']) => {
    const id = `particle-${Date.now()}-${Math.random()}`;
    const newParticle: ParticleEffect = {
      id,
      x,
      y,
      type,
      duration: type === 'victory' ? 3000 : 1500,
      startTime: Date.now(),
    };

    setGameState(prev => ({
      ...prev,
      particleEffects: [...prev.particleEffects, newParticle]
    }));

    // Remove particle after duration
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        particleEffects: prev.particleEffects.filter(p => p.id !== id)
      }));
    }, newParticle.duration);
  }, []);

  // Calculate territory control
  const calculateTerritoryControl = useCallback((grid: Cell[][]) => {
    const totalCells = GRID_SIZE * GRID_SIZE;
    const revealedCells = grid.flat().filter(cell => cell.isRevealed).length;
    return Math.round((revealedCells / totalCells) * 100);
  }, []);

  // Check victory conditions
  const checkVictoryConditions = useCallback(() => {
    const { player, territoryControlPercentage, achievements } = gameState;
    
    // Territory control victory (60%)
    if (territoryControlPercentage >= 60) {
      return { won: true, type: 'territory' as const };
    }
    
    // Resource victory (5000 gold, 200 population, 500 food, 100 military)
    if (player.gold >= 5000 && player.population >= 200 && player.food >= 500 && player.militaryStrength >= 100) {
      return { won: true, type: 'resources' as const };
    }
    
    // Building victory (all building types built)
    const masterArchitect = achievements.find(a => a.id === 'all_buildings');
    if (masterArchitect?.unlocked) {
      return { won: true, type: 'buildings' as const };
    }
    
    return { won: false, type: undefined };
  }, [gameState]);

  // Update achievements
  const updateAchievements = useCallback((newState: GameState) => {
    const updatedAchievements = newState.achievements.map(achievement => {
      const newAchievement = { ...achievement };
      
      switch (achievement.id) {
        case 'first_building':
          const buildingCount = newState.grid.flat().filter(cell => 
            cell.building && cell.building.owner === 'player'
          ).length;
          newAchievement.progress = Math.min(buildingCount, 1);
          newAchievement.unlocked = buildingCount >= 1;
          break;
          
        case 'gold_collector':
          newAchievement.progress = Math.min(newState.player.gold, 1000);
          newAchievement.unlocked = newState.player.gold >= 1000;
          break;
          
        case 'empire_builder':
          newAchievement.progress = Math.min(newState.territoryControlPercentage, 25);
          newAchievement.unlocked = newState.territoryControlPercentage >= 25;
          break;
          
        case 'all_buildings':
          const uniqueBuildings = new Set(
            newState.grid.flat()
              .filter(cell => cell.building && cell.building.owner === 'player')
              .map(cell => cell.building!.type)
          );
          newAchievement.progress = uniqueBuildings.size;
          newAchievement.unlocked = uniqueBuildings.size >= 7;
          break;
          
        case 'population_boom':
          newAchievement.progress = Math.min(newState.player.population, 100);
          newAchievement.unlocked = newState.player.population >= 100;
          break;
      }
      
      return newAchievement;
    });
    
    return updatedAchievements;
  }, []);

  // Generate random events
  const generateRandomEvents = useCallback((turn: number, season: Season): TurnEvent[] => {
    const events: TurnEvent[] = [];
    const randomChance = Math.random();
    
    // Weather effects (10% chance)
    if (randomChance < 0.1) {
      const weatherEvents = [
        { message: `${season.icon} Perfect weather boosts all production by 15%!`, icon: '🌈', severity: 'positive' as const },
        { message: '⛈️ Storms reduce military effectiveness this turn.', icon: '⚡', severity: 'negative' as const },
        { message: '🌙 Clear skies improve night operations.', icon: '✨', severity: 'positive' as const },
      ];
      events.push({
        type: 'weather_effect',
        ...weatherEvents[Math.floor(Math.random() * weatherEvents.length)]
      });
    }
    
    // Resource discoveries (8% chance)
    if (randomChance > 0.1 && randomChance < 0.18) {
      const discoveries = [
        { message: 'Miners discovered a rich gold vein! +200 gold bonus.', icon: '⛏️', severity: 'positive' as const },
        { message: 'Fertile lands discovered! +50 food production.', icon: '🌾', severity: 'positive' as const },
        { message: 'Ancient ruins found! +20 population joins your empire.', icon: '🏛️', severity: 'positive' as const },
      ];
      events.push({
        type: 'resource_discovery',
        ...discoveries[Math.floor(Math.random() * discoveries.length)]
      });
    }
    
    // Bandit attacks (5% chance)
    if (randomChance > 0.18 && randomChance < 0.23) {
      events.push({
        type: 'bandit_attack',
        message: '🏴‍☠️ Bandits attack! Lost some resources but gained military experience.',
        icon: '⚔️',
        severity: 'negative'
      });
    }
    
    // Seasonal changes (every 4 turns)
    if (turn % 4 === 0 && turn > 1) {
      const seasonIndex = Math.floor((turn - 1) / 4) % 4;
      const newSeason = SEASONS[seasonIndex];
      events.push({
        type: 'seasonal_change',
        message: `${newSeason.icon} ${newSeason.name} arrives! New bonuses and visual theme active.`,
        icon: newSeason.icon,
        severity: 'neutral'
      });
    }
    
    return events;
  }, []);

  const calculateDistance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
  };

  const findNearestBuilding = useCallback((x: number, y: number, buildingType?: Building['type']) => {
    let minDistance = Infinity;
    gameState.grid.flat().forEach(cell => {
      if (cell.building && cell.building.owner === 'player') {
        if (!buildingType || cell.building.type === buildingType) {
          const distance = calculateDistance(x, y, cell.x, cell.y);
          minDistance = Math.min(minDistance, distance);
        }
      }
    });
    return minDistance === Infinity ? null : minDistance;
  }, [gameState.grid]);

  const calculateAdjacencyBonus = useCallback((x: number, y: number, buildingType: Building['type']) => {
    let totalBonus = 0;
    const bonuses = (ADJACENCY_BONUSES as any)[buildingType] || {};
    
    // Check all adjacent cells (8-directional)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const adjX = x + dx;
        const adjY = y + dy;
        
        if (adjX >= 0 && adjX < GRID_SIZE && adjY >= 0 && adjY < GRID_SIZE) {
          const adjCell = gameState.grid[adjY][adjX];
          if (adjCell.building && adjCell.building.owner === 'player') {
            const bonus = bonuses[adjCell.building.type] || 0;
            totalBonus += bonus;
          }
        }
      }
    }
    
    return totalBonus;
  }, [gameState.grid]);

  const canAffordBuilding = useCallback((buildingType: Building['type']) => {
    const cost = BUILDING_COSTS[buildingType as keyof typeof BUILDING_COSTS];
  return (
      gameState.player.gold >= cost.gold &&
      gameState.player.food >= cost.food &&
      gameState.player.population >= cost.population
    );
  }, [gameState.player]);

  const isValidPlacement = useCallback((x: number, y: number, buildingType: Building['type']) => {
    const cell = gameState.grid[y][x];
    
    if (!cell.isRevealed || cell.building || cell.terrain === 'water') {
      return false;
    }

    const rules = PLACEMENT_RULES[buildingType];
    if (!rules.validTerrain.includes(cell.terrain)) {
      return false;
    }

    // Check distance requirements
    if (buildingType !== 'castle') {
      const distanceToNearestBuilding = findNearestBuilding(x, y);
      if (distanceToNearestBuilding === null) return false;
      
      if (distanceToNearestBuilding < rules.minDistance || distanceToNearestBuilding > rules.maxDistance) {
        return false;
      }
    }

    return true;
  }, [gameState.grid, findNearestBuilding]);

  const revealAdjacentCells = useCallback((x: number, y: number, grid: Cell[][]) => {
    const newGrid = [...grid];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const newX = x + dx;
        const newY = y + dy;
        if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
          newGrid[newY][newX].isRevealed = true;
        }
      }
    }
    return newGrid;
  }, []);

  const handleDragStart = (e: React.DragEvent, buildingType: Building['type']) => {
    setDragState({
      isDragging: true,
      draggedBuilding: buildingType,
      dragOverCell: null,
    });
    e.dataTransfer.setData('building', buildingType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      draggedBuilding: null,
      dragOverCell: null,
    });
  };

  const handleDragOver = (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragState(prev => ({
      ...prev,
      dragOverCell: { x, y }
    }));
  };

  const handleDragLeave = () => {
    setDragState(prev => ({
      ...prev,
      dragOverCell: null
    }));
  };

  const handleDrop = (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    const buildingType = e.dataTransfer.getData('building') as Building['type'];
    
    if (isValidPlacement(x, y, buildingType) && canAffordBuilding(buildingType)) {
      placeBuilding(x, y, buildingType);
    }
    
    handleDragEnd();
  };

  const updateAllAdjacencyBonuses = (grid: Cell[][]) => {
    grid.flat().forEach(cell => {
      if (cell.building && cell.building.owner === 'player') {
        const bonus = calculateAdjacencyBonus(cell.x, cell.y, cell.building.type);
        cell.building.income = getBaseIncome(cell.building.type) + bonus;
        cell.adjacencyBonus = bonus;
      }
    });
  };

  const calculateTurnResources = useCallback(() => {
    let goldChange = 5; // Base income
    let populationChange = 1; // Natural growth
    let foodChange = -2; // Base consumption
    let militaryChange = 0;
    
    gameState.grid.flat().forEach(cell => {
      if (cell.building?.owner === 'player') {
        const effects = BUILDING_EFFECTS[cell.building.type];
        const bonus = cell.adjacencyBonus || 0;
        
        // Add production
        goldChange += effects.produces.gold + bonus;
        populationChange += effects.produces.population;
        foodChange += effects.produces.food;
        militaryChange += effects.produces.military;
        
        // Subtract consumption
        goldChange -= effects.consumes.gold;
        populationChange -= effects.consumes.population;
        foodChange -= effects.consumes.food;
        militaryChange -= effects.consumes.military;
      }
    });

    return { 
      gold: goldChange, 
      population: populationChange, 
      food: foodChange, 
      military: militaryChange 
    };
  }, [gameState.grid, calculateAdjacencyBonus, getBaseIncome]);

  // Encapsulated building placement logic
  const placeBuilding = useCallback((x: number, y: number, buildingType: Building['type']) => {
    if (!isValidPlacement(x, y, buildingType) || !canAffordBuilding(buildingType)) return;

    const cost = BUILDING_COSTS[buildingType as keyof typeof BUILDING_COSTS];
    const adjacencyBonus = calculateAdjacencyBonus(x, y, buildingType);
    
    addParticleEffect(x, y, 'build');
    
    setGameState(prev => {
      const newGrid = revealAdjacentCells(x, y, prev.grid);
      newGrid[y][x].building = { 
        type: buildingType, 
        level: 1, 
        owner: 'player',
        income: getBaseIncome(buildingType) + adjacencyBonus,
        adjacencyBonuses: []
      };
      newGrid[y][x].adjacencyBonus = adjacencyBonus;
      
      updateAllAdjacencyBonuses(newGrid);
      
      const newTerritoryControl = calculateTerritoryControl(newGrid);
      const newState = {
        ...prev,
        grid: newGrid,
        player: {
          ...prev.player,
          gold: prev.player.gold - cost.gold,
          food: prev.player.food - cost.food,
          population: prev.player.population - cost.population + (buildingType === 'house' ? 2 : 0),
        },
        territoryControlPercentage: newTerritoryControl,
      };
      
      // Update achievements
      const oldAchievements = prev.achievements;
      newState.achievements = updateAchievements(newState);
      
      // Check for newly unlocked achievements
      const newlyUnlocked = newState.achievements.filter((ach, index) => 
        ach.unlocked && !oldAchievements[index].unlocked
      );
      
      if (newlyUnlocked.length > 0) {
        newlyUnlocked.forEach(achievement => {
          addParticleEffect(x, y, 'sparkle');
        });
      }
      
      return newState;
    });
  }, [
    isValidPlacement, canAffordBuilding, calculateAdjacencyBonus, addParticleEffect, 
    revealAdjacentCells, getBaseIncome, updateAllAdjacencyBonuses, calculateTerritoryControl, 
    updateAchievements
  ]);

  const handleCellClick = useCallback((x: number, y: number) => {
    if (placingBuilding) {
      if (isValidPlacement(x, y, placingBuilding) && canAffordBuilding(placingBuilding)) {
        placeBuilding(x, y, placingBuilding);
        setPlacingBuilding(null);
      }
      return; // In placement mode, a click either places a building or does nothing.
    }

    const cell = gameState.grid[y][x];
    
    if (!cell.isRevealed) return;
    
    setGameState(prev => ({ ...prev, selectedCell: { x, y } }));
  }, [placingBuilding, gameState.grid, isValidPlacement, canAffordBuilding, placeBuilding]);

  const generateTurnEvents = useCallback((resourceChanges: ResourceChange, buildingCount: number) => {
    const events: TurnEvent[] = [];
    
    // Population growth events
    if (resourceChanges.population > 2) {
      events.push({
        type: 'population_growth',
        message: `Your population is booming! +${resourceChanges.population} citizens joined your empire.`,
        icon: '👥'
      });
    }
    
    // Resource bonus events
    if (resourceChanges.gold > 50) {
      events.push({
        type: 'trade_success',
        message: `Excellent trade routes! Your merchants earned an extra +${Math.floor(resourceChanges.gold * 0.1)} gold.`,
        icon: '💰'
      });
    }
    
    // Military training events
    if (resourceChanges.military > 5) {
      events.push({
        type: 'military_training',
        message: `Your forces grow stronger! Military training yields +${resourceChanges.military} strength.`,
        icon: '⚔️'
      });
    }
    
    // Building efficiency events
    if (buildingCount > 5) {
      events.push({
        type: 'resource_bonus',
        message: `Your well-planned city provides efficiency bonuses to all buildings!`,
        icon: '🏗️'
      });
    }
    
    // Food shortage warning
    if (resourceChanges.food < -10) {
      events.push({
        type: 'resource_bonus',
        message: `Food supplies are running low. Consider building more farms.`,
        icon: '⚠️'
      });
    }
    
    return events;
  }, []);

  const nextTurn = useCallback(() => {
    setGameState(prev => {
      // Set loading state
      prev.isLoading = true;
      
      const resourceChanges = calculateTurnResources();
      const newTimeOfDay: 'day' | 'night' = prev.timeOfDay === 'day' ? 'night' : 'day';
      const buildingCount = prev.grid.flat().filter(cell => cell.building?.owner === 'player').length;
      
      // Check for seasonal changes
      const seasonIndex = Math.floor(prev.turn / 4) % 4;
      const newSeason = SEASONS[seasonIndex];
      const seasonChanged = newSeason.name !== prev.currentSeason.name;
      
      // Apply seasonal bonuses
      const seasonalBonuses = {
        gold: Math.round(resourceChanges.gold * newSeason.effects.goldBonus),
        population: Math.round(resourceChanges.population * 0),
        food: Math.round(resourceChanges.food * newSeason.effects.foodBonus),
        military: Math.round(resourceChanges.military * newSeason.effects.militaryBonus),
      };
      
      const adjustedResourceChanges = {
        gold: resourceChanges.gold + seasonalBonuses.gold,
        population: resourceChanges.population,
        food: resourceChanges.food + seasonalBonuses.food,
        military: resourceChanges.military + seasonalBonuses.military,
      };
      
      // Generate events including random events
      const basicEvents = generateTurnEvents(adjustedResourceChanges, buildingCount);
      const randomEvents = generateRandomEvents(prev.turn + 1, newSeason);
      const allEvents = [...basicEvents, ...randomEvents];
      
      // Apply random event effects
      let eventBonuses = { gold: 0, population: 0, food: 0, military: 0 };
      randomEvents.forEach(event => {
        switch (event.type) {
          case 'resource_discovery':
            if (event.message.includes('gold')) eventBonuses.gold += 200;
            if (event.message.includes('food')) eventBonuses.food += 50;
            if (event.message.includes('population')) eventBonuses.population += 20;
            break;
          case 'bandit_attack':
            eventBonuses.gold -= 50;
            eventBonuses.food -= 20;
            eventBonuses.military += 5; // Experience gained
            break;
        }
      });
      
      const finalResourceChanges = {
        gold: adjustedResourceChanges.gold + eventBonuses.gold,
        population: adjustedResourceChanges.population + eventBonuses.population,
        food: adjustedResourceChanges.food + eventBonuses.food,
        military: adjustedResourceChanges.military + eventBonuses.military,
      };
      
      const newPlayer = {
        ...prev.player,
        gold: Math.max(0, prev.player.gold + finalResourceChanges.gold),
        population: Math.max(1, prev.player.population + finalResourceChanges.population),
        food: Math.max(0, prev.player.food + finalResourceChanges.food),
        militaryStrength: Math.max(0, prev.player.militaryStrength + finalResourceChanges.military),
        army: Math.max(0, prev.player.army + Math.floor(finalResourceChanges.military / 2)),
      };

      const newState = {
        ...prev,
        turn: prev.turn + 1,
        timeOfDay: newTimeOfDay,
        isTransitioning: true,
        showTurnSummary: true,
        showEndTurnConfirm: false,
        player: newPlayer,
        resourceChanges: finalResourceChanges,
        lastTurnIncome: finalResourceChanges,
        turnEvents: allEvents,
        currentSeason: newSeason,
        isLoading: false,
      };
      
      // Update achievements
      newState.achievements = updateAchievements(newState);
      
      // Check victory conditions
      const victoryCheck = checkVictoryConditions();
      if (victoryCheck.won) {
        newState.gameWon = true;
        newState.victoryType = victoryCheck.type;
        newState.showVictoryScreen = true;
        newState.gamePhase = 'victory';
        
        // Add victory particle effects
        for (let i = 0; i < 10; i++) {
          setTimeout(() => {
            const x = Math.random() * GRID_SIZE;
            const y = Math.random() * GRID_SIZE;
            addParticleEffect(x, y, 'victory');
          }, i * 200);
        }
      }
      
      // Add sparkle effects for positive resource gains
      if (finalResourceChanges.gold > 50) addParticleEffect(6, 6, 'coin');
      
      return newState;
    });
    
    // End transition after 3 seconds
    setTimeout(() => {
      setGameState(prev => ({ ...prev, isTransitioning: false }));
    }, 3000);
  }, [calculateTurnResources, generateTurnEvents, generateRandomEvents, updateAchievements, checkVictoryConditions, addParticleEffect]);

  const confirmEndTurn = () => {
    setGameState(prev => ({ ...prev, showEndTurnConfirm: true }));
  };

  const cancelEndTurn = () => {
    setGameState(prev => ({ ...prev, showEndTurnConfirm: false }));
  };

  const closeTurnSummary = () => {
    setGameState(prev => ({ ...prev, showTurnSummary: false }));
  };

  const getPlacementFeedback = (cell: Cell) => {
    const buildingToValidate = dragState.draggedBuilding || placingBuilding;
    if (!buildingToValidate) return '';
    if (!cell.isRevealed || cell.building || cell.terrain === 'water') return '';

    const isValid = isValidPlacement(cell.x, cell.y, buildingToValidate) && canAffordBuilding(buildingToValidate);

    // Desktop: drag-over has priority
    const isDragOver = dragState.dragOverCell?.x === cell.x && dragState.dragOverCell?.y === cell.y;
    if (isDragOver) {
      return isValid ? 'bg-green-400 bg-opacity-50 ring-2 ring-green-300' : 'bg-red-400 bg-opacity-50 ring-2 ring-red-300';
    }
    
    // Mobile placement mode OR Desktop drag-n-drop hint
    if (placingBuilding || dragState.isDragging) {
      return isValid ? 'bg-green-400 bg-opacity-40' : 'bg-red-400 bg-opacity-30';
    }
    
    return '';
  };

  const getTerrainColors = (terrain: Cell['terrain']) => {
    const isNight = gameState.timeOfDay === 'night';
    return isNight ? TERRAIN_COLORS_NIGHT[terrain] : TERRAIN_COLORS[terrain];
  };

  const getCellContent = (cell: Cell) => {
    const isNight = gameState.timeOfDay === 'night';
    
    if (!cell.isRevealed) {
      return (
        <div className={`w-full h-full ${isNight ? 'fog-of-war-night' : 'fog-of-war'}`} />
      );
    }

    return (
      <div className={`w-full h-full bg-gradient-to-br ${getTerrainColors(cell.terrain)} relative overflow-hidden ${getPlacementFeedback(cell)} transition-all duration-3000`}>
        {/* Night overlay for atmospheric effect */}
        {isNight && (
          <div className="absolute inset-0 bg-blue-950 bg-opacity-30 pointer-events-none" />
        )}
        
        {cell.building && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`text-2xl ${cell.building.owner === 'player' ? 'text-blue-800' : 'text-red-800'} transition-all duration-1000`}>
              {BUILDING_ICONS[cell.building.type]}
            </div>
            
            {/* Building glow effect at night */}
            {isNight && cell.building && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-6 h-6 rounded-full ${
                  cell.building.type === 'house' ? 'bg-yellow-400 bg-opacity-40 shadow-yellow-400' :
                  cell.building.type === 'castle' ? 'bg-blue-400 bg-opacity-40 shadow-blue-400' :
                  cell.building.type === 'market' ? 'bg-purple-400 bg-opacity-40 shadow-purple-400' :
                  cell.building.type === 'barracks' ? 'bg-red-400 bg-opacity-40 shadow-red-400' :
                  cell.building.type === 'tower' ? 'bg-white bg-opacity-40 shadow-white' :
                  'bg-orange-400 bg-opacity-40 shadow-orange-400'
                } shadow-glow animate-pulse`} />
              </div>
            )}
            
            {cell.adjacencyBonus > 0 && (
              <div 
                className="absolute -top-1.5 -right-1.5 text-xs bg-yellow-400 text-black rounded-full px-1.5 py-0.5 flex items-center justify-center font-bold shadow-md"
                title={`Adjacency Bonus: +${cell.adjacencyBonus}`}
              >
                +{cell.adjacencyBonus}
              </div>
            )}
          </div>
        )}
        
        {cell.terrain === 'forest' && !cell.building && (
          <div className={`absolute inset-0 flex items-center justify-center text-green-200 text-lg transition-colors duration-1000 text-shadow-light`}>
            🌲
          </div>
        )}
        
        {cell.terrain === 'mountain' && !cell.building && (
          <div className={`absolute inset-0 flex items-center justify-center text-slate-300 text-lg transition-colors duration-1000 text-shadow-light`}>
            ⛰️
          </div>
        )}
        
        {cell.resources > 15 && !cell.building && (
          <div className={`absolute top-0 right-0 text-xs ${isNight ? 'text-yellow-300 bg-yellow-900' : 'text-yellow-600 bg-yellow-200'} rounded-bl px-1 transition-colors duration-1000`}>
            {cell.resources}
          </div>
        )}
        
        {/* Moonlight reflection on water at night */}
        {isNight && cell.terrain === 'water' && (
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-blue-300 to-transparent opacity-20 animate-pulse" />
        )}
      </div>
    );
  };

  const getBackgroundTheme = () => {
    const isNight = gameState.timeOfDay === 'night';
    const isTransitioning = gameState.isTransitioning;
    
    if (isTransitioning) {
      // Enhanced transition with gradient animation
      return `min-h-screen bg-gradient-to-br ${
        isNight 
          ? 'from-blue-400 via-purple-500 to-slate-950 animate-pulse' 
          : 'from-slate-950 via-purple-800 to-blue-400 animate-pulse'
      } text-slate-50 relative overflow-hidden transition-all duration-[3000ms] ease-in-out`;
    }
    
    if (isNight) {
      return `min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-slate-50 relative overflow-hidden transition-all duration-[3000ms] ease-in-out`;
    } else {
      return `min-h-screen bg-gradient-to-br from-blue-400 via-sky-300 to-amber-200 text-slate-800 relative overflow-hidden transition-all duration-[3000ms] ease-in-out`;
    }
  };

  // Minimap Component
  const Minimap = () => (
    <div className="card p-4">
      <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
        <span className="text-xl">🗺️</span>
        Minimap
      </h3>
      <div className="grid grid-cols-12 gap-px w-full aspect-square bg-slate-800 rounded-lg overflow-hidden">
        {gameState.grid.flat().map((cell, index) => (
          <div
            key={index}
            className={`
              smooth-transition cursor-pointer
              ${!cell.isRevealed ? 'bg-slate-900' : 
                cell.building ? 'bg-blue-400 hover:bg-blue-300' : 
                cell.terrain === 'water' ? 'bg-blue-600 hover:bg-blue-500' :
                cell.terrain === 'mountain' ? 'bg-slate-500 hover:bg-slate-400' :
                cell.terrain === 'forest' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-400 hover:bg-emerald-300'
              }
              ${gameState.selectedCell?.x === cell.x && gameState.selectedCell?.y === cell.y ? 'ring-1 ring-amber-400 ring-inset' : ''}
            `}
            onClick={() => handleCellClick(cell.x, cell.y)}
          />
        ))}
      </div>
    </div>
  );

  // Particle Effects Component
  const ParticleEffects = () => (
    <div className="fixed inset-0 pointer-events-none z-50">
      {gameState.particleEffects.map(particle => (
        <div
          key={particle.id}
          className={`particle-${particle.type}`}
          style={{
            left: `${(particle.x / GRID_SIZE) * 100}%`,
            top: `${(particle.y / GRID_SIZE) * 100}%`,
          }}
        />
      ))}
    </div>
  );

  // Progress Tracking Component
  const ProgressTracker = () => {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (gameState.territoryControlPercentage / 100) * circumference;

    const progressTextColor = isNight ? 'text-slate-300' : 'text-slate-600';
    const progressValueColor = isNight ? 'text-lg font-bold' : 'text-lg font-bold text-slate-800';
    const progressSubtextColor = isNight ? 'text-slate-400' : 'text-slate-500';

    const resourceMetBg = isNight ? 'bg-emerald-900/30 text-emerald-200' : 'bg-emerald-100 text-emerald-800 font-medium';
    const resourceNotMetBg = isNight ? 'bg-slate-800/30 text-slate-200' : 'bg-slate-200 text-slate-700';
    
    return (
      <div className="card p-4">
        <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent flex items-center gap-2">
          <span className="text-xl">🏆</span>
          Victory Progress
        </h3>
        
        {/* Territory Control */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm ${progressTextColor}`}>Territory Control</span>
            <div className="flex items-center gap-2">
              <svg width="50" height="50" className="progress-circle">
                <circle
                  cx="25"
                  cy="25"
                  r={radius}
                  stroke="rgb(71, 85, 105)"
                  strokeWidth="3"
                  fill="none"
                />
                <circle
                  cx="25"
                  cy="25"
                  r={radius}
                  stroke="rgb(59, 130, 246)"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="smooth-transition-300"
                />
              </svg>
              <span className={progressValueColor}>{gameState.territoryControlPercentage}%</span>
            </div>
          </div>
          <div className="progress-bar h-2 rounded-full">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full smooth-transition-300"
              style={{ width: `${gameState.territoryControlPercentage}%` }}
            />
          </div>
          <div className={`text-xs mt-1 ${progressSubtextColor}`}>Need 60% to win</div>
        </div>

        {/* Resource Victory */}
        <div className="mb-4">
          <div className={`text-sm mb-2 ${progressTextColor}`}>Resource Victory</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-2 rounded ${gameState.player.gold >= 5000 ? resourceMetBg : resourceNotMetBg}`}>
              💰 {gameState.player.gold}/5000
            </div>
            <div className={`p-2 rounded ${gameState.player.population >= 200 ? resourceMetBg : resourceNotMetBg}`}>
              👥 {gameState.player.population}/200
            </div>
            <div className={`p-2 rounded ${gameState.player.food >= 500 ? resourceMetBg : resourceNotMetBg}`}>
              🌾 {gameState.player.food}/500
            </div>
            <div className={`p-2 rounded ${gameState.player.militaryStrength >= 100 ? resourceMetBg : resourceNotMetBg}`}>
              ⚔️ {gameState.player.militaryStrength}/100
            </div>
          </div>
        </div>

        {/* Building Victory */}
        <div>
          <div className={`text-sm mb-2 ${progressTextColor}`}>Building Victory</div>
          <div className={`text-xs ${progressTextColor}`}>
            {(() => {
              const uniqueBuildings = new Set(
                gameState.grid.flat()
                  .filter(cell => cell.building && cell.building.owner === 'player')
                  .map(cell => cell.building!.type)
              );
              return `${uniqueBuildings.size}/7 building types built`;
            })()}
          </div>
        </div>
      </div>
    );
  };

  // Achievements Component
  const AchievementsPanel = () => {
    const isNight = gameState.timeOfDay === 'night';
    
    return (
      <div className="card p-4">
        <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
          <span className="text-xl">🏅</span>
          Achievements
        </h3>
        <div className="space-y-2 overflow-y-auto pr-2">
          {gameState.achievements.map(achievement => {
            const isUnlocked = achievement.unlocked;
            const cardStyle = isUnlocked
              ? (isNight ? 'bg-emerald-900/20 border-emerald-500' : 'bg-emerald-100 border-emerald-500')
              : (isNight ? 'bg-slate-800/30 border-slate-600/30' : 'bg-slate-200/70 border-slate-300');
            
            const nameColor = isUnlocked 
              ? (isNight ? 'text-emerald-300' : 'text-emerald-600') 
              : (isNight ? 'text-slate-300' : 'text-slate-700');
              
            const descriptionColor = isNight ? 'text-slate-400' : 'text-slate-500';
            
            const progressColor = isUnlocked
              ? (isNight ? 'text-emerald-400' : 'text-emerald-600')
              : (isNight ? 'text-slate-300' : 'text-slate-600');
            
            const progressBarBg = isNight ? 'bg-slate-700' : 'bg-slate-300';
            
            return (
              <div
                key={achievement.id}
                className={`p-3 rounded-lg border transition-colors duration-300 ${cardStyle}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-1">{achievement.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <div className={`font-semibold ${nameColor} truncate flex items-center gap-2`}>
                        {isUnlocked && <span className="text-emerald-500 font-bold">✓</span>}
                        <span>{achievement.name}</span>
                      </div>
                      <div className={`text-sm font-bold flex-shrink-0 ${progressColor}`}>
                        {achievement.progress}/{achievement.maxProgress}
                      </div>
                    </div>
                    <div className={`text-xs mt-1 ${descriptionColor}`}>{achievement.description}</div>
                    
                    {!isUnlocked && (
                      <div className={`rounded-full h-1 mt-2 ${progressBarBg}`}>
                        <div 
                          className="bg-gradient-to-r from-yellow-400 to-orange-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                        />
                      </div>
                    )}
                    
                    {isUnlocked && achievement.reward && (
                      <div className="text-xs text-amber-500 mt-2 font-medium">✨ {achievement.reward}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Season Indicator Component
  const SeasonIndicator = () => {
    const isNight = gameState.timeOfDay === 'night';
    const textColor = isNight ? 'text-slate-100' : 'text-slate-800';
    const subTextColor = isNight ? 'text-slate-400' : 'text-slate-500';
    
    return (
      <div className="card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{gameState.currentSeason.icon}</span>
            <div>
              <div className={`font-bold ${textColor}`}>{gameState.currentSeason.name}</div>
              <div className={`text-xs ${subTextColor}`}>Turn {gameState.turn}</div>
            </div>
          </div>
          <div className="text-xs text-right space-y-px">
            <div className="text-emerald-500 text-shadow-light font-medium">+{Math.round(gameState.currentSeason.effects.goldBonus * 100)}% 💰</div>
            <div className="text-green-500 text-shadow-light font-medium">+{Math.round(gameState.currentSeason.effects.foodBonus * 100)}% 🌾</div>
            <div className="text-red-500 text-shadow-light font-medium">+{Math.round(gameState.currentSeason.effects.militaryBonus * 100)}% ⚔️</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={getBackgroundTheme()}>
      {/* Embedded CSS Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
@import 'tailwindcss';

/* Custom animations and styles for the game */
@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-5px);
  }
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

.float {
  animation: float 3s ease-in-out infinite;
}

.shimmer {
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Ensure proper sizing for the grid */
.aspect-square {
  aspect-ratio: 1 / 1;
}

/* Custom glass morphism effect */
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Text selection color */
::selection {
  background: rgba(59, 130, 246, 0.3);
  color: white;
}

/* Focus styles */
button:focus,
div:focus {
  outline: 2px solid rgba(59, 130, 246, 0.5);
  outline-offset: 2px;
}

/* Improved transitions */
* {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Custom gradient backgrounds */
.bg-gradient-royal {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.bg-gradient-gold {
  background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%);
}

.bg-gradient-emerald {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

/* Grid cell animations */
.grid-cell {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.grid-cell:hover {
  transform: scale(1.05);
  z-index: 10;
  position: relative;
}

/* Fog of war effect */
.fog-of-war {
  background: linear-gradient(
    -45deg,
    rgba(107, 114, 128, 0.6),
    rgba(75, 85, 99, 0.7),
    rgba(55, 65, 81, 0.6),
    rgba(75, 85, 99, 0.7)
  );
  background-size: 400% 400%;
  animation: fog-animation 15s ease infinite;
  border: 1px solid rgba(107, 114, 128, 0.5);
}

.fog-of-war-night {
  background: linear-gradient(
    -45deg,
    rgba(17, 24, 39, 0.8),
    rgba(31, 41, 55, 0.9),
    rgba(55, 65, 81, 0.8),
    rgba(31, 41, 55, 0.9)
  );
  background-size: 400% 400%;
  animation: fog-animation 15s ease infinite;
  border: 1px solid rgba(55, 65, 81, 0.5);
}

@keyframes fog-animation {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Building placement highlight */
.building-highlight {
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

/* Resource indicator */
.resource-indicator {
  font-size: 10px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
}

/* Mobile responsiveness improvements */
@media (max-width: 768px) {
  .grid-cols-12 {
    gap: 0.125rem;
  }
  
  .grid-cell {
    border-width: 0.5px;
  }
  
  .text-3xl {
    font-size: 1.5rem;
  }
  
  .p-6 {
    padding: 1rem;
  }
  
  /* Touch-optimized styles for mobile */
  .cursor-pointer {
    cursor: default;
  }
  
  button, [role="button"] {
    min-height: 44px;
    min-width: 44px;
    -webkit-tap-highlight-color: transparent;
  }
  
  /* Prevent zoom on touch inputs */
  input, select, textarea {
    font-size: 16px;
  }
  
  /* Improve scroll performance */
  .overflow-y-auto {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
}

/* Empire Conquest Color Palette & Theme System */
:root {
  /* Primary Colors */
  --royal-blue: #1e40af;
  --royal-blue-light: #3b82f6;
  --royal-blue-dark: #1e3a8a;
  
  --emerald-green: #059669;
  --emerald-green-light: #10b981;
  --emerald-green-dark: #047857;
  
  --golden-yellow: #d97706;
  --golden-yellow-light: #f59e0b;
  --golden-yellow-dark: #b45309;
  
  /* Accent Colors */
  --deep-purple: #7c3aed;
  --deep-purple-light: #8b5cf6;
  --deep-purple-dark: #6d28d9;
  
  --warm-orange: #ea580c;
  --warm-orange-light: #f97316;
  --warm-orange-dark: #c2410c;
  
  /* Neutral Colors */
  --slate-gray: #475569;
  --slate-gray-light: #64748b;
  --slate-gray-dark: #334155;
  --slate-gray-darker: #1e293b;
  
  --warm-white: #f8fafc;
  --warm-white-dark: #f1f5f9;
  
  /* Surface Colors */
  --surface-primary: rgba(30, 64, 175, 0.1);
  --surface-secondary: rgba(71, 85, 105, 0.8);
  --surface-elevated: rgba(248, 250, 252, 0.05);
  
  /* Shadow System */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  /* Border Radius System */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}

/* Typography System */
body {
  background-color: #0f0f23;
  color: var(--warm-white);
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
  line-height: 1.6;
}

/* Enhanced Button System */
.btn-primary {
  background: linear-gradient(135deg, var(--royal-blue), var(--royal-blue-dark));
  color: var(--warm-white);
  border: none;
  border-radius: var(--radius-lg);
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  box-shadow: var(--shadow-md);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--royal-blue-light), var(--royal-blue));
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
}

.btn-success {
  background: linear-gradient(135deg, var(--emerald-green), var(--emerald-green-dark));
  color: var(--warm-white);
  border: none;
  border-radius: var(--radius-lg);
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  box-shadow: var(--shadow-md);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.btn-success:hover {
  background: linear-gradient(135deg, var(--emerald-green-light), var(--emerald-green));
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.btn-warning {
  background: linear-gradient(135deg, var(--golden-yellow), var(--golden-yellow-dark));
  color: var(--warm-white);
  border: none;
  border-radius: var(--radius-lg);
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  box-shadow: var(--shadow-md);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.btn-warning:hover {
  background: linear-gradient(135deg, var(--golden-yellow-light), var(--golden-yellow));
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

/* Enhanced Card System */
.card {
  background: var(--surface-elevated);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(248, 250, 252, 0.1);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  box-shadow: var(--shadow-xl);
  transform: translateY(-2px);
  border-color: rgba(248, 250, 252, 0.2);
}

.card-elevated {
  background: rgba(30, 64, 175, 0.05);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(30, 64, 175, 0.2);
  box-shadow: 
    var(--shadow-xl),
    0 0 0 1px rgba(30, 64, 175, 0.1);
}

/* Resource Indicator Colors */
.resource-gold {
  color: var(--golden-yellow-light);
  background: linear-gradient(135deg, var(--golden-yellow), var(--golden-yellow-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}

.resource-population {
  color: var(--royal-blue-light);
  background: linear-gradient(135deg, var(--royal-blue), var(--royal-blue-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}

.resource-food {
  color: var(--emerald-green-light);
  background: linear-gradient(135deg, var(--emerald-green), var(--emerald-green-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}

.resource-military {
  color: var(--warm-orange-light);
  background: linear-gradient(135deg, var(--warm-orange), var(--warm-orange-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}

/* Building Type Colors */
.building-castle {
  background: linear-gradient(135deg, var(--royal-blue), var(--deep-purple));
  border: 2px solid var(--royal-blue-light);
}

.building-house {
  background: linear-gradient(135deg, var(--golden-yellow), var(--warm-orange));
  border: 2px solid var(--golden-yellow-light);
}

.building-farm {
  background: linear-gradient(135deg, var(--emerald-green), var(--emerald-green-dark));
  border: 2px solid var(--emerald-green-light);
}

.building-mine {
  background: linear-gradient(135deg, var(--slate-gray), var(--slate-gray-dark));
  border: 2px solid var(--slate-gray-light);
}

.building-barracks {
  background: linear-gradient(135deg, var(--warm-orange), var(--warm-orange-dark));
  border: 2px solid var(--warm-orange-light);
}

.building-tower {
  background: linear-gradient(135deg, var(--deep-purple), var(--deep-purple-dark));
  border: 2px solid var(--deep-purple-light);
}

.building-market {
  background: linear-gradient(135deg, var(--deep-purple), var(--royal-blue));
  border: 2px solid var(--deep-purple-light);
}

/* Custom utility classes */
.scale-102 {
  transform: scale(1.02);
}

/* Enhanced font weights */
.font-bold {
  font-weight: 700;
}

.font-extrabold {
  font-weight: 800;
}

/* Particle Effects */
@keyframes sparkle {
  0%, 100% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(180deg);
  }
}

@keyframes coinBounce {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.5);
  }
  50% {
    opacity: 1;
    transform: translateY(-10px) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translateY(-30px) scale(0.8);
  }
}

@keyframes buildPulse {
  0% {
    opacity: 0;
    transform: scale(0.8);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
    box-shadow: 0 0 0 20px rgba(34, 197, 94, 0);
  }
  100% {
    opacity: 0;
    transform: scale(1);
    box-shadow: 0 0 0 40px rgba(34, 197, 94, 0);
  }
}

@keyframes victoryBurst {
  0% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: scale(1.5) rotate(90deg);
  }
  70% {
    opacity: 0.8;
    transform: scale(2) rotate(270deg);
  }
  100% {
    opacity: 0;
    transform: scale(3) rotate(360deg);
  }
}

.particle-sparkle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: radial-gradient(circle, #fbbf24, #f59e0b);
  border-radius: 50%;
  animation: sparkle 1.5s ease-out forwards;
  pointer-events: none;
  z-index: 100;
}

.particle-coin {
  position: absolute;
  width: 12px;
  height: 12px;
  background: linear-gradient(45deg, #fbbf24, #f59e0b);
  border-radius: 50%;
  animation: coinBounce 1.5s ease-out forwards;
  pointer-events: none;
  z-index: 100;
}

.particle-build {
  position: absolute;
  width: 16px;
  height: 16px;
  background: rgba(34, 197, 94, 0.8);
  border-radius: 50%;
  animation: buildPulse 1.5s ease-out forwards;
  pointer-events: none;
  z-index: 100;
}

.particle-victory {
  position: absolute;
  width: 20px;
  height: 20px;
  background: conic-gradient(from 0deg, #fbbf24, #f59e0b, #dc2626, #7c3aed, #3b82f6, #10b981);
  border-radius: 50%;
  animation: victoryBurst 3s ease-out forwards;
  pointer-events: none;
  z-index: 100;
}

/* Micro-interactions */
.btn-micro-interaction {
  position: relative;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-micro-interaction::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.3s ease, height 0.3s ease;
}

.btn-micro-interaction:hover::before {
  width: 300px;
  height: 300px;
}

.btn-micro-interaction:active {
  transform: scale(0.98);
}

/* Card lift effect */
.card-lift {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-lift:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1), 
    0 10px 10px -5px rgba(0, 0, 0, 0.04),
    0 0 0 1px rgba(59, 130, 246, 0.2);
}

/* Loading states */
.skeleton {
  background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.progress-bar {
  position: relative;
  overflow: hidden;
  background: rgba(71, 85, 105, 0.3);
  border-radius: 9999px;
}

.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: progress-shimmer 2s infinite;
}

@keyframes progress-shimmer {
  0% {
    transform: translateX(-100%);
    width: 100%;
  }
  100% {
    transform: translateX(200%);
    width: 100%;
  }
}

/* Enhanced transitions */
.smooth-transition {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.smooth-transition-300 {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Achievement unlock animation */
@keyframes achievement-unlock {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
  }
  50% {
    opacity: 1;
    transform: scale(1.1) translateY(-5px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.achievement-unlock {
  animation: achievement-unlock 0.6s ease-out forwards;
}

/* Seasonal theme transitions */
.seasonal-transition {
  transition: all 3s ease-in-out;
}

/* Victory screen animations */
@keyframes victory-fade-in {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.victory-screen {
  animation: victory-fade-in 0.5s ease-out forwards;
}

/* Progress indicator */
.progress-circle {
  transform: rotate(-90deg);
  transition: stroke-dashoffset 0.3s ease;
}

/* Loading animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.6s ease-out;
}

/* Day/Night cycle animations */
@keyframes twinkle {
  0%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes dayNightTransition {
  0% {
    filter: brightness(1) hue-rotate(0deg);
  }
  50% {
    filter: brightness(0.7) hue-rotate(180deg);
  }
  100% {
    filter: brightness(0.5) hue-rotate(240deg);
  }
}

.animate-twinkle {
  animation: twinkle ease-in-out infinite;
}

.animate-float {
  animation: float 4s ease-in-out infinite;
}

.day-night-transition {
  animation: dayNightTransition 3s ease-in-out;
}

/* Custom shadow effects for glowing buildings */
.shadow-glow {
  box-shadow: 0 0 15px currentColor, 0 0 30px currentColor, 0 0 45px currentColor;
}

.shadow-yellow-400 {
  box-shadow: 0 0 15px #facc15, 0 0 30px #facc15, 0 0 45px #facc15;
}

.shadow-blue-400 {
  box-shadow: 0 0 15px #60a5fa, 0 0 30px #60a5fa, 0 0 45px #60a5fa;
}

.shadow-purple-400 {
  box-shadow: 0 0 15px #c084fc, 0 0 30px #c084fc, 0 0 45px #c084fc;
}

.shadow-red-400 {
  box-shadow: 0 0 15px #f87171, 0 0 30px #f87171, 0 0 45px #f87171;
}

.shadow-white {
  box-shadow: 0 0 15px #ffffff, 0 0 30px #ffffff, 0 0 45px #ffffff;
}

.shadow-orange-400 {
  box-shadow: 0 0 15px #fb923c, 0 0 30px #fb923c, 0 0 45px #fb923c;
}

/* Day theme enhancements */
.day-theme {
  background: linear-gradient(135deg, #60a5fa 0%, #38bdf8 25%, #fbbf24 75%, #f59e0b 100%);
  color: #1f2937;
}

.day-theme .terrain-grass {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  box-shadow: inset 0 0 20px rgba(34, 197, 94, 0.3);
}

.day-theme .terrain-water {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  box-shadow: inset 0 0 20px rgba(59, 130, 246, 0.4);
}

/* Night theme enhancements */
.night-theme {
  background: linear-gradient(135deg, #1e1b4b 0%, #581c87 25%, #374151 75%, #111827 100%);
  color: #f9fafb;
}

.night-theme .terrain-grass {
  background: linear-gradient(135deg, #166534, #14532d);
  box-shadow: inset 0 0 20px rgba(21, 101, 52, 0.5);
}

.night-theme .terrain-water {
  background: linear-gradient(135deg, #1e3a8a, #312e81);
  box-shadow: inset 0 0 20px rgba(30, 58, 138, 0.6);
}

/* Moonlight effects */
.moonlight-glow {
  position: relative;
}

.moonlight-glow::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(147, 197, 253, 0.1) 0%, transparent 70%);
  pointer-events: none;
  animation: pulse 4s ease-in-out infinite;
}

/* Sunlight effects */
.sunlight-rays {
  position: relative;
  overflow: hidden;
}

.sunlight-rays::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 200%;
  height: 100%;
  background: linear-gradient(
    45deg,
    transparent 40%,
    rgba(251, 191, 36, 0.1) 50%,
    transparent 60%
  );
  animation: sunRays 8s linear infinite;
  pointer-events: none;
}

@keyframes sunRays {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Transition timing for smooth day/night changes */
.duration-3000 {
  transition-duration: 3000ms;
}

/* Enhanced building glow effects */
.building-night-glow {
  position: relative;
}

.building-night-glow::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120%;
  height: 120%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, currentColor 0%, transparent 70%);
  opacity: 0.3;
  animation: pulse 2s ease-in-out infinite;
  pointer-events: none;
}

/* Button hover effects */
.btn-hover-effect {
  position: relative;
  overflow: hidden;
}

.btn-hover-effect::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  transition: left 0.5s;
}

.btn-hover-effect:hover::before {
  left: 100%;
}

/* Terrain-specific styling */
.terrain-grass {
  background: linear-gradient(135deg, #22c55e, #16a34a);
}

.terrain-forest {
  background: linear-gradient(135deg, #15803d, #166534);
}

.terrain-mountain {
  background: linear-gradient(135deg, #6b7280, #4b5563);
}

.terrain-water {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  position: relative;
}

.terrain-water::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
  animation: shimmer 3s linear infinite;
}

/* Text readability utilities */
.text-shadow {
  text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
}

.text-shadow-light {
  text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
}

.text-shadow-night {
  text-shadow: 1px 1px 3px rgba(0,0,0,0.8), 0 0 5px rgba(255, 255, 255, 0.2);
}
        `
      }} />
      
      {/* Particle Effects */}
      <ParticleEffects />
      
      {/* Stars at night */}
      {/* Particle Effects */}
      <ParticleEffects />
      
      {/* Stars at night */}
      {gameState.timeOfDay === 'night' && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full opacity-70 animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}
      
      {/* Sun/Moon indicator */}
      <div className="absolute top-4 right-4 text-4xl animate-float z-10 lg:hidden">
        {gameState.timeOfDay === 'day' ? '☀️' : '🌙'}
      </div>

      {/* Mobile Header - Sticky */}
      <div className="lg:hidden sticky top-0 z-40 card border-b border-slate-700">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            ⚔️ Empire
          </h1>
          
          {/* Mobile Resource Display */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-2xl">💰</span>
              <AnimatedCounter value={gameState.player.gold} className="resource-gold font-bold" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl">👥</span>
              <AnimatedCounter value={gameState.player.population} className="resource-population font-bold" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl">🌾</span>
              <AnimatedCounter value={gameState.player.food} className="resource-food font-bold" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl">⚔️</span>
              <AnimatedCounter value={gameState.player.militaryStrength} className="resource-military font-bold" />
            </div>
          </div>
          
          {/* <button
            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all duration-200 hover:scale-105 ml-2"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </button> */}
        </div>
        
        {/* Mobile Turn Info */}
        <div className="px-4 pb-3 border-t border-slate-700/50">
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-300 font-medium">Turn {gameState.turn}</span>
            <span className={`flex items-center gap-2 font-semibold ${gameState.timeOfDay === 'day' ? 'text-amber-400' : 'text-blue-300'}`}>
              <span className="text-lg">{gameState.timeOfDay === 'day' ? '☀️' : '🌙'}</span>
              <span className="capitalize">{gameState.timeOfDay}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block card-elevated p-6">
        <div className="max-w-full mx-auto flex justify-between items-center flex-wrap gap-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
            ⚔️ Empire Conquest
          </h1>
          <div className="flex gap-8 text-sm">
            <div className="flex flex-col items-center card p-3 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-3xl">💰</span>
                <AnimatedCounter value={gameState.player.gold} className="resource-gold text-lg font-bold" />
              </div>
              {gameState.lastTurnIncome.gold !== 0 && (
                <div className={`text-xs mt-1 ${gameState.lastTurnIncome.gold > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {gameState.lastTurnIncome.gold > 0 ? '+' : ''}{gameState.lastTurnIncome.gold}/turn
                </div>
              )}
            </div>
            <div className="flex flex-col items-center card p-3 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👥</span>
                <AnimatedCounter value={gameState.player.population} className="resource-population text-lg font-bold" />
              </div>
              {gameState.lastTurnIncome.population !== 0 && (
                <div className={`text-xs mt-1 ${gameState.lastTurnIncome.population > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {gameState.lastTurnIncome.population > 0 ? '+' : ''}{gameState.lastTurnIncome.population}/turn
                </div>
              )}
            </div>
            <div className="flex flex-col items-center card p-3 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🌾</span>
                <AnimatedCounter value={gameState.player.food} className="resource-food text-lg font-bold" />
              </div>
              {gameState.lastTurnIncome.food !== 0 && (
                <div className={`text-xs mt-1 ${gameState.lastTurnIncome.food > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {gameState.lastTurnIncome.food > 0 ? '+' : ''}{gameState.lastTurnIncome.food}/turn
                </div>
              )}
            </div>
            <div className="flex flex-col items-center card p-3 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚔️</span>
                <AnimatedCounter value={gameState.player.militaryStrength} className="resource-military text-lg font-bold" />
              </div>
              {gameState.lastTurnIncome.military !== 0 && (
                <div className={`text-xs mt-1 ${gameState.lastTurnIncome.military > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {gameState.lastTurnIncome.military > 0 ? '+' : ''}{gameState.lastTurnIncome.military}/turn
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 card p-3 rounded-xl">
              <span className="text-purple-400 text-2xl">🕐</span>
              <span className={`font-semibold ${isNight ? 'text-slate-100' : 'text-slate-800'}`}>Turn {gameState.turn}</span>
            </div>
            <div className="flex items-center gap-3 card p-3 rounded-xl">
              <span className={`text-2xl ${gameState.timeOfDay === 'day' ? 'text-amber-400' : 'text-blue-300'}`}>
                {gameState.timeOfDay === 'day' ? '☀️' : '🌙'}
              </span>
              <span className={`capitalize font-semibold ${isNight ? 'text-slate-100' : 'text-slate-800'}`}>{gameState.timeOfDay}</span>
              {gameState.isTransitioning && (
                <span className="text-sm text-slate-400 animate-pulse ml-2">Transitioning...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout (≥1024px) */}
      <div className="hidden lg:flex h-[calc(100vh-120px)]">
        {/* Left Panel - 300px */}
        <div className="w-[300px] flex-shrink-0 p-4 space-y-4 overflow-y-auto">
          {/* Building Palette */}
          <div className="card p-6">
            <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-3">
              <span className="text-2xl">🏗️</span>
              Buildings
            </h3>
            <div className="space-y-2">
              {Object.entries(BUILDING_COSTS).map(([buildingType, cost]) => {
                const canAfford = canAffordBuilding(buildingType as Building['type']);
                const effects = BUILDING_EFFECTS[buildingType as keyof typeof BUILDING_EFFECTS];
                
                return (
                  <div
                    key={buildingType}
                    className={`
                      w-full p-4 rounded-xl text-left transition-all duration-300 flex flex-col cursor-move card
                      ${canAfford ? 'hover:card-elevated hover:scale-102' : 'bg-red-900 bg-opacity-30 opacity-50 cursor-not-allowed'}
                      ${dragState.draggedBuilding === buildingType ? 'ring-2 ring-blue-400 scale-95' : ''}
                    `}
                    draggable={canAfford}
                    onDragStart={(e) => canAfford && handleDragStart(e, buildingType as Building['type'])}
                    onDragEnd={handleDragEnd}
                    title={PLACEMENT_RULES[buildingType as keyof typeof PLACEMENT_RULES]?.description || ''}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{BUILDING_ICONS[buildingType as keyof typeof BUILDING_ICONS]}</span>
                        <div>
                          <div className="capitalize font-bold text-lg text-slate-100">{buildingType}</div>
                        </div>
                      </div>
                      <div className="text-sm text-right space-y-1">
                        <div className="resource-gold flex items-center gap-1">
                          <span>{cost.gold}</span><span className="text-lg">💰</span>
                        </div>
                        {cost.food > 0 && (
                          <div className="resource-food flex items-center gap-1">
                            <span>{cost.food}</span><span className="text-lg">🌾</span>
                          </div>
                        )}
                        {cost.population > 0 && (
                          <div className="resource-population flex items-center gap-1">
                            <span>{cost.population}</span><span className="text-lg">👥</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-emerald-900/20 p-2 rounded-lg border border-emerald-500/30">
                        <div className="font-bold text-emerald-300 mb-1">Produces:</div>
                        {effects.produces.gold > 0 && <div className="resource-gold">+{effects.produces.gold}💰/turn</div>}
                        {effects.produces.population > 0 && <div className="resource-population">+{effects.produces.population}👥/turn</div>}
                        {effects.produces.food > 0 && <div className="resource-food">+{effects.produces.food}🌾/turn</div>}
                        {effects.produces.military > 0 && <div className="resource-military">+{effects.produces.military}⚔️/turn</div>}
                      </div>
                      <div className="bg-red-900/20 p-2 rounded-lg border border-red-500/30">
                        <div className="font-bold text-red-300 mb-1">Consumes:</div>
                        {effects.consumes.gold > 0 && <div className="text-red-300">-{effects.consumes.gold}💰/turn</div>}
                        {effects.consumes.population > 0 && <div className="text-red-300">-{effects.consumes.population}👥/turn</div>}
                        {effects.consumes.food > 0 && <div className="text-red-300">-{effects.consumes.food}🌾/turn</div>}
                        {effects.consumes.military > 0 && <div className="text-red-300">-{effects.consumes.military}⚔️/turn</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-sm text-slate-300 bg-slate-800/30 p-3 rounded-lg border border-slate-600/30">
              <span className="text-xl mr-2">💡</span>
              Drag buildings to the map to place them
            </div>
          </div>

          {/* Game Controls */}
          <div className="card p-6">
            <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent flex items-center gap-3">
              <span className="text-2xl">🎮</span>
              Actions
            </h3>
            <div className="space-y-4">
              <button
                className="btn-success btn-micro-interaction w-full text-lg py-4 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                onClick={confirmEndTurn}
                disabled={gameState.isTransitioning || gameState.gameWon}
              >
                {gameState.isTransitioning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Processing...
                  </span>
                ) : gameState.gameWon ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="text-xl">🏆</span>
                    Victory Achieved!
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>End Turn</span>
                    <span className="text-xl">⏭️</span>
                  </span>
                )}
              </button>
              
              {/* Turn Info */}
              <div className="text-sm text-gray-300 bg-gray-800 bg-opacity-50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span>Current Phase:</span>
                  <span className={`font-semibold ${gameState.timeOfDay === 'day' ? 'text-yellow-400' : 'text-blue-300'}`}>
                    {gameState.timeOfDay === 'day' ? '☀️ Day' : '🌙 Night'} {gameState.turn}
                  </span>
                </div>
                <div className="text-xs text-gray-300 mt-1">
                  {gameState.timeOfDay === 'day' ? 'Perfect time for building and expansion' : 'Buildings work through the night'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Area - Game Grid */}
        <div className="flex-1 p-4">
          <div className="rounded-xl p-6 backdrop-blur-sm h-full flex flex-col">
            {/* Zoom Controls */}
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-semibold ${isNight ? 'text-white' : 'text-slate-800'}`}>Empire Map</h3>
              <div className="flex items-center gap-2">
                <button
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  onClick={zoomOut}
                >
                  ➖
                </button>
                <span className={`text-sm min-w-[60px] text-center ${isNight ? 'text-white' : 'text-slate-800'}`}>
                  {Math.round(gridZoom * 100)}%
                </span>
                <button
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  onClick={zoomIn}
                >
                  ➕
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto flex items-center justify-center">
              <div 
                className="grid grid-cols-12 gap-1"
                style={{ 
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  transform: `scale(${gridZoom})`,
                  transformOrigin: 'center'
                }}
              >
                {gameState.grid.flat().map((cell, index) => (
                  <div
                    key={index}
                    className={`
                      w-12 h-12 border border-gray-700 rounded cursor-pointer transition-all duration-200
                      ${hoveredCell?.x === cell.x && hoveredCell?.y === cell.y ? 'ring-2 ring-yellow-400 scale-105' : ''}
                      ${gameState.selectedCell?.x === cell.x && gameState.selectedCell?.y === cell.y ? 'ring-2 ring-blue-400' : ''}
                    `}
                    onMouseEnter={() => setHoveredCell({ x: cell.x, y: cell.y })}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => handleCellClick(cell.x, cell.y)}
                    onDragOver={(e) => handleDragOver(e, cell.x, cell.y)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, cell.x, cell.y)}
                  >
                    {getCellContent(cell)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - 280px */}
        <div className="w-[280px] flex-shrink-0 p-4 space-y-4 overflow-y-auto">
          <SeasonIndicator />
          <ProgressTracker />
          <Minimap />
          
          {/* Selected Cell Info */}
          {gameState.selectedCell && (
            <div className="card p-4 card-lift">
              <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent flex items-center gap-2">
                <span className="text-xl">📍</span>
                Cell Info
              </h3>
              {(() => {
                const cell = gameState.grid[gameState.selectedCell.y][gameState.selectedCell.x];
                return (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className={`${isNight ? 'text-slate-400' : 'text-slate-500'}`}>Position:</span>
                      <span className={`font-mono ${isNight ? 'text-slate-100' : 'text-slate-800'}`}>({cell.x}, {cell.y})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${isNight ? 'text-slate-400' : 'text-slate-500'}`}>Terrain:</span>
                      <span className={`capitalize font-medium ${isNight ? 'text-slate-100' : 'text-slate-800'}`}>{cell.terrain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${isNight ? 'text-slate-400' : 'text-slate-500'}`}>Resources:</span>
                      <span className={`font-medium ${isNight ? 'text-slate-100' : 'text-slate-800'}`}>{cell.resources}</span>
                    </div>
                    {cell.building && (
                      <div className="border-t border-slate-600/30 pt-3 space-y-2">
                        <div className="flex justify-between">
                          <span className={`${isNight ? 'text-slate-400' : 'text-slate-500'}`}>Building:</span>
                          <span className={`capitalize font-medium ${isNight ? 'text-slate-100' : 'text-slate-800'}`}>{cell.building.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`${isNight ? 'text-slate-400' : 'text-slate-500'}`}>Level:</span>
                          <span className={`font-medium ${isNight ? 'text-slate-100' : 'text-slate-800'}`}>{cell.building.level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`${isNight ? 'text-slate-400' : 'text-slate-500'}`}>Income:</span>
                          <span className={`resource-gold font-medium ${isNight ? 'text-slate-100' : 'text-slate-800'}`}>{cell.building.income}/turn</span>
                        </div>
                        {cell.adjacencyBonus > 0 && (
                          <div className="flex justify-between">
                            <span className={`${isNight ? 'text-slate-400' : 'text-slate-500'}`}>Bonus:</span>
                            <span className="text-amber-400 font-medium">+{cell.adjacencyBonus}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className={`${isNight ? 'text-slate-400' : 'text-slate-500'}`}>Owner:</span>
                          <span className={`capitalize font-medium ${isNight ? 'text-slate-100' : 'text-slate-800'}`}>{cell.building.owner}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <AchievementsPanel />
        </div>
      </div>

      {/* Tablet Layout (768px-1023px) */}
      <div className="hidden md:block lg:hidden">
        {/* Main Game Area */}
        <div className="p-4">
          <div className="rounded-xl p-6 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-semibold ${isNight ? 'text-white' : 'text-slate-800'}`}>Empire Map</h3>
              <div className="flex items-center gap-2">
                <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg" onClick={zoomOut}>➖</button>
                <span className={`text-sm min-w-[60px] text-center ${isNight ? 'text-white' : 'text-slate-800'}`}>{Math.round(gridZoom * 100)}%</span>
                <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg" onClick={zoomIn}>➕</button>
              </div>
            </div>
            
            <div className="overflow-auto">
              <div 
                className="grid grid-cols-12 gap-1 mx-auto"
                style={{ 
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  transform: `scale(${gridZoom})`,
                  transformOrigin: 'center',
                  width: 'fit-content'
                }}
              >
                {gameState.grid.flat().map((cell, index) => (
                  <div
                    key={index}
                    className={`
                      w-10 h-10 border border-gray-700 rounded cursor-pointer transition-all duration-200
                      ${hoveredCell?.x === cell.x && hoveredCell?.y === cell.y ? 'ring-2 ring-yellow-400 scale-105' : ''}
                      ${gameState.selectedCell?.x === cell.x && gameState.selectedCell?.y === cell.y ? 'ring-2 ring-blue-400' : ''}
                    `}
                    onMouseEnter={() => setHoveredCell({ x: cell.x, y: cell.y })}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => handleCellClick(cell.x, cell.y)}
                    onDragOver={(e) => handleDragOver(e, cell.x, cell.y)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, cell.x, cell.y)}
                  >
                    {getCellContent(cell)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Collapsible Panel for Tablet */}
        <div className="border-t border-gray-700 bg-black bg-opacity-50">
          <button
            className="w-full p-4 text-center text-gray-300 hover:text-white"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ? '⬇️ Hide Controls' : '⬆️ Show Controls'}
          </button>
          
          {isMobileMenuOpen && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {/* Building Palette */}
              <div className="bg-black bg-opacity-30 rounded-xl p-4 backdrop-blur-sm">
                <h3 className="text-lg font-semibold mb-4 text-yellow-400">🏗️ Buildings</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(BUILDING_COSTS).map(([buildingType, cost]) => {
                    const canAfford = canAffordBuilding(buildingType as Building['type']);
                    
                    return (
                      <div
                        key={buildingType}
                        className={`
                          w-full p-3 rounded-lg text-left transition-all duration-200 flex items-center justify-between cursor-move
                          ${canAfford ? 'bg-gray-800 bg-opacity-50 hover:bg-gray-700' : 'bg-red-900 bg-opacity-30 opacity-50'}
                        `}
                        draggable={canAfford}
                        onDragStart={(e) => canAfford && handleDragStart(e, buildingType as Building['type'])}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{BUILDING_ICONS[buildingType as keyof typeof BUILDING_ICONS]}</span>
                          <span className="capitalize font-semibold">{buildingType}</span>
                        </div>
                        <span className="text-yellow-400">{cost.gold}💰</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Controls and Info */}
              <div className="space-y-4">
                <div className="bg-black bg-opacity-30 rounded-xl p-4 backdrop-blur-sm">
                  <button
                    className="w-full p-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={confirmEndTurn}
                    disabled={gameState.isTransitioning}
                  >
                    {gameState.isTransitioning ? 'Processing...' : 'End Turn ⏭️'}
                  </button>
                </div>

                <div className="bg-black bg-opacity-30 rounded-xl p-4 backdrop-blur-sm">
                  <button
                    className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all duration-200"
                    onClick={toggleMinimap}
                  >
                    {isMinimapOpen ? 'Hide Minimap' : 'Show Minimap 🗺️'}
                  </button>
                  {isMinimapOpen && <div className="mt-4"><Minimap /></div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout (<768px) - Vertical Stack */}
      <div className="md:hidden flex flex-col h-screen">
        {/* 2. Building List - Horizontally Scrollable */}
        <div className="bg-slate-800/30 border-b border-slate-700/50 p-3">
          <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isNight ? 'text-slate-300' : 'text-slate-700'}`}>
            <span>🏗️</span>
            Buildings - Drag to Place
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Object.entries(BUILDING_COSTS).map(([buildingType, cost]) => {
              const canAfford = canAffordBuilding(buildingType as Building['type']);
              
              return (
                <div
                  key={buildingType}
                  className={`
                    flex-shrink-0 w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center cursor-move transition-all duration-200
                    ${canAfford 
                      ? (isNight ? 'bg-slate-700/70 border-slate-600 hover:bg-slate-600/70 hover:border-slate-500' : 'bg-slate-200/70 border-slate-400 hover:bg-slate-300/70 hover:border-slate-500') + ' hover:scale-105'
                      : (isNight ? 'bg-red-900/30 border-red-700/50' : 'bg-red-200/30 border-red-400/50') + ' opacity-50 cursor-not-allowed'
                    }
                  `}
                  draggable={canAfford}
                  onDragStart={(e) => canAfford && handleDragStart(e, buildingType as Building['type'])}
                  onDragEnd={handleDragEnd}
                  title={`${buildingType} - ${cost.gold}💰`}
                >
                  <span className="text-2xl">{BUILDING_ICONS[buildingType as keyof typeof BUILDING_ICONS]}</span>
                  <span className={`text-xs font-semibold capitalize mt-1 ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>{buildingType}</span>
                  <span className={`text-xs font-medium ${isNight ? 'text-yellow-400' : 'text-yellow-600'}`}>{cost.gold}💰</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Main Game Grid */}
        <div className="flex-1 p-2 overflow-hidden">
          <div className="bg-black bg-opacity-10 rounded-xl p-3 h-full flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className={`text-sm font-semibold ${isNight ? 'text-white' : 'text-white'}`}>Empire Map</h3>
              <div className="flex items-center gap-2">
                <button className={`p-1 rounded text-xs ${isNight ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-300 hover:bg-gray-400 text-slate-800'}`} onClick={zoomOut}>➖</button>
                <span className={`text-xs min-w-[45px] text-center ${isNight ? 'text-white' : 'text-white'}`}>{Math.round(gridZoom * 100)}%</span>
                <button className={`p-1 rounded text-xs ${isNight ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-300 hover:bg-gray-400 text-slate-800'}`} onClick={zoomIn}>➕</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <div 
                className="grid grid-cols-12 gap-1 mx-auto"
                style={{ 
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  transform: `scale(${gridZoom})`,
                  transformOrigin: 'center',
                  width: 'fit-content'
                }}
              >
                {gameState.grid.flat().map((cell, index) => (
                  <div
                    key={index}
                    className={`
                      w-10 h-10 border border-gray-700 rounded cursor-pointer transition-all duration-200
                      ${hoveredCell?.x === cell.x && hoveredCell?.y === cell.y ? 'ring-1 ring-yellow-400 scale-110' : ''}
                      ${gameState.selectedCell?.x === cell.x && gameState.selectedCell?.y === cell.y ? 'ring-1 ring-blue-400' : ''}
                    `}
                    onTouchStart={() => setHoveredCell({ x: cell.x, y: cell.y })}
                    onTouchEnd={() => setHoveredCell(null)}
                    onClick={() => handleCellClick(cell.x, cell.y)}
                    onDragOver={(e) => handleDragOver(e, cell.x, cell.y)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, cell.x, cell.y)}
                  >
                    {getCellContent(cell)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Actions Section */}
        <div className="bg-slate-800/30 border-t border-slate-700/50 p-3">
          <button
            className="w-full p-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-lg text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={confirmEndTurn}
            disabled={gameState.isTransitioning || gameState.gameWon}
          >
            {gameState.isTransitioning ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Processing...</span>
              </>
            ) : gameState.gameWon ? (
              <>
                <span className="text-xl">🏆</span>
                <span>Victory Achieved!</span>
              </>
            ) : (
              <>
                <span>End Turn</span>
                <span className="text-xl">⏭️</span>
              </>
            )}
          </button>
        </div>

        {/* 5. Player Profile and Game Status */}
        <div className="bg-slate-800/30 border-t border-slate-700/50 p-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Player Stats */}
            <div>
              <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isNight ? 'text-slate-300' : 'text-slate-700'}`}>
                <span>👤</span>
                Empire Status
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className={isNight ? 'text-slate-400' : 'text-slate-600'}>Territory:</span>
                  <span className={`font-medium ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>{gameState.territoryControlPercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className={isNight ? 'text-slate-400' : 'text-slate-600'}>Turn:</span>
                  <span className={`font-medium ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>{gameState.turn}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isNight ? 'text-slate-400' : 'text-slate-600'}>Season:</span>
                  <span className={`font-medium flex items-center gap-1 ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>
                    <span>{gameState.currentSeason.icon}</span>
                    <span>{gameState.currentSeason.name}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Achievements */}
            <div>
              <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isNight ? 'text-slate-300' : 'text-slate-700'}`}>
                <span>🏅</span>
                Progress
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className={isNight ? 'text-slate-400' : 'text-slate-600'}>Achievements:</span>
                  <span className={`font-medium ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>
                    {gameState.achievements.filter(a => a.unlocked).length}/{gameState.achievements.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isNight ? 'text-slate-400' : 'text-slate-600'}>Buildings:</span>
                  <span className={`font-medium ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>
                    {gameState.grid.flat().filter(cell => cell.building && cell.building.owner === 'player').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isNight ? 'text-slate-400' : 'text-slate-600'}>Phase:</span>
                  <span className={`font-medium ${gameState.timeOfDay === 'day' ? 'text-amber-500' : 'text-blue-400'}`}>
                    {gameState.timeOfDay === 'day' ? '☀️ Day' : '🌙 Night'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Minimap Section - Collapsible */}
        <div className="bg-slate-800/30 border-t border-slate-700/50">
          <button
            className={`w-full p-3 text-left transition-all duration-200 flex items-center justify-between ${isNight ? 'text-slate-300 hover:text-white hover:bg-slate-700/30' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/30'}`}
            onClick={toggleMinimap}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🗺️</span>
              <span className="font-semibold text-sm">Minimap</span>
            </div>
            <span className={`text-lg transition-transform duration-200 ${isMinimapOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          
          {isMinimapOpen && (
            <div className="p-3 pt-0">
              <div className={`rounded-lg p-3 ${isNight ? 'bg-slate-900/50' : 'bg-slate-100/50'}`}>
                <Minimap />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Placement Mode Indicator - Keep for fallback */}
      {placingBuilding && (
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-black/70 backdrop-blur-sm z-40">
          <div className="p-4 flex items-center justify-between">
            <div className="text-white">
              <span className="text-sm">Placing Building:</span>
              <div className="font-bold text-lg capitalize flex items-center gap-2">
                {BUILDING_ICONS[placingBuilding]}
                {placingBuilding}
              </div>
            </div>
            <button
              className="btn-danger px-4 py-2"
              onClick={() => setPlacingBuilding(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="card-elevated p-6 text-center mt-8">
        <div className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          Empire Conquest - Professional Strategy Game
        </div>
        <div className={`text-sm mt-2 ${isNight ? 'text-white' : 'text-slate-800'}`}>
          Build your empire across all devices with style and precision
        </div>
      </div>

        {/* End Turn Confirmation Dialog */}
        {gameState.showEndTurnConfirm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50">
            <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
              <h3 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
                ⏭️ End Turn Confirmation
              </h3>
              
              <div className="mb-4 text-gray-300">
                <p className="mb-2">Are you ready to advance to the next phase?</p>
                <p className="text-sm text-gray-400">
                  Current: <span className={gameState.timeOfDay === 'day' ? 'text-yellow-400' : 'text-blue-300'}>
                    {gameState.timeOfDay === 'day' ? '☀️ Day' : '🌙 Night'} {gameState.turn}
                  </span>
                </p>
                <p className="text-sm text-gray-400">
                  Next: <span className={gameState.timeOfDay === 'night' ? 'text-yellow-400' : 'text-blue-300'}>
                    {gameState.timeOfDay === 'night' ? '☀️ Day' : '🌙 Night'} {gameState.turn + 1}
                  </span>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                  onClick={nextTurn}
                >
                  ✓ Confirm
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                  onClick={cancelEndTurn}
                >
                  ✗ Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Turn Summary Popup */}
        {gameState.showTurnSummary && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50">
            <div className="card-elevated bg-gray-900/95 backdrop-blur-sm p-6 max-w-lg w-full mx-4 max-h-96 overflow-y-auto">
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent mb-4 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                Turn {gameState.turn} Summary
              </h3>
              
              {/* Season & Phase Transition */}
              <div className="mb-4 p-3 card rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">Season:</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{gameState.currentSeason.icon}</span>
                    <span className="font-semibold">{gameState.currentSeason.name}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Phase Transition:</span>
                  <span className={`font-semibold ${gameState.timeOfDay === 'day' ? 'text-amber-400' : 'text-blue-300'}`}>
                    {gameState.timeOfDay === 'day' ? '🌙 Night → ☀️ Day' : '☀️ Day → 🌙 Night'}
                  </span>
                </div>
              </div>

              {/* Resource Changes */}
              <div className="mb-4">
                <h4 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  Resource Changes
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={`flex justify-between p-3 rounded-lg ${gameState.lastTurnIncome.gold >= 0 ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
                    <span>💰 Gold:</span>
                    <span className={`font-bold ${gameState.lastTurnIncome.gold >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gameState.lastTurnIncome.gold >= 0 ? '+' : ''}{gameState.lastTurnIncome.gold}
                    </span>
                  </div>
                  <div className={`flex justify-between p-3 rounded-lg ${gameState.lastTurnIncome.population >= 0 ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
                    <span>👥 Population:</span>
                    <span className={`font-bold ${gameState.lastTurnIncome.population >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gameState.lastTurnIncome.population >= 0 ? '+' : ''}{gameState.lastTurnIncome.population}
                    </span>
                  </div>
                  <div className={`flex justify-between p-3 rounded-lg ${gameState.lastTurnIncome.food >= 0 ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
                    <span>🌾 Food:</span>
                    <span className={`font-bold ${gameState.lastTurnIncome.food >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gameState.lastTurnIncome.food >= 0 ? '+' : ''}{gameState.lastTurnIncome.food}
                    </span>
                  </div>
                  <div className={`flex justify-between p-3 rounded-lg ${gameState.lastTurnIncome.military >= 0 ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
                    <span>⚔️ Military:</span>
                    <span className={`font-bold ${gameState.lastTurnIncome.military >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gameState.lastTurnIncome.military >= 0 ? '+' : ''}{gameState.lastTurnIncome.military}
                    </span>
                  </div>
                </div>
              </div>

              {/* Events */}
              {gameState.turnEvents.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">
                    <span className="text-xl">📰</span>
                    Events
                  </h4>
                  <div className="space-y-2">
                    {gameState.turnEvents.map((event, index) => (
                      <div key={index} className={`flex items-start gap-3 p-3 rounded-lg card ${
                        event.severity === 'positive' ? 'border-emerald-500/30' :
                        event.severity === 'negative' ? 'border-red-500/30' : 'border-slate-600/30'
                      }`}>
                        <span className="text-xl">{event.icon}</span>
                        <p className="text-sm text-slate-300 flex-1">{event.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empire Status */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                  <span className="text-xl">🏰</span>
                  Empire Status
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between p-3 card rounded-lg">
                    <span>💰 Total Gold:</span>
                    <span className="resource-gold font-bold">{gameState.player.gold}</span>
                  </div>
                  <div className="flex justify-between p-3 card rounded-lg">
                    <span>👥 Population:</span>
                    <span className="resource-population font-bold">{gameState.player.population}</span>
                  </div>
                  <div className="flex justify-between p-3 card rounded-lg">
                    <span>🌾 Food Stores:</span>
                    <span className="resource-food font-bold">{gameState.player.food}</span>
                  </div>
                  <div className="flex justify-between p-3 card rounded-lg">
                    <span>⚔️ Military:</span>
                    <span className="resource-military font-bold">{gameState.player.militaryStrength}</span>
                  </div>
                </div>
              </div>

              <button
                className="btn-primary btn-micro-interaction w-full text-lg py-3 font-bold"
                onClick={closeTurnSummary}
              >
                <span className="flex items-center justify-center gap-2">
                  <span>Continue Playing</span>
                  <span className="text-xl">▶️</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Victory Screen */}
        {gameState.showVictoryScreen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-lg flex items-center justify-center z-50">
            <div className="victory-screen card-elevated p-8 max-w-2xl w-full mx-4 text-center">
              <div className="mb-6">
                <div className="text-6xl mb-4 animate-bounce">🏆</div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent mb-2">
                  VICTORY ACHIEVED!
                </h2>
                <div className="text-xl text-slate-300">
                  {gameState.victoryType === 'territory' && 'Territorial Domination'}
                  {gameState.victoryType === 'resources' && 'Economic Supremacy'}
                  {gameState.victoryType === 'buildings' && 'Architectural Mastery'}
                </div>
              </div>

              {/* Victory Stats */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="card p-4">
                  <div className="text-3xl mb-2">⏰</div>
                  <div className="text-lg font-bold text-slate-100">Turn {gameState.turn}</div>
                  <div className="text-sm text-slate-400">Total Turns</div>
                </div>
                <div className="card p-4">
                  <div className="text-3xl mb-2">🗺️</div>
                  <div className="text-lg font-bold text-slate-100">{gameState.territoryControlPercentage}%</div>
                  <div className="text-sm text-slate-400">Territory Control</div>
                </div>
                <div className="card p-4">
                  <div className="text-3xl mb-2">🏗️</div>
                  <div className="text-lg font-bold text-slate-100">
                    {gameState.grid.flat().filter(cell => cell.building && cell.building.owner === 'player').length}
                  </div>
                  <div className="text-sm text-slate-400">Buildings Built</div>
                </div>
                <div className="card p-4">
                  <div className="text-3xl mb-2">🏅</div>
                  <div className="text-lg font-bold text-slate-100">
                    {gameState.achievements.filter(a => a.unlocked).length}/{gameState.achievements.length}
                  </div>
                  <div className="text-sm text-slate-400">Achievements</div>
                </div>
              </div>

              {/* Final Resources */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-100 mb-4">Final Empire Status</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="card p-3">
                    <div className="text-2xl mb-1">💰</div>
                    <div className="resource-gold font-bold text-lg">{gameState.player.gold}</div>
                  </div>
                  <div className="card p-3">
                    <div className="text-2xl mb-1">👥</div>
                    <div className="resource-population font-bold text-lg">{gameState.player.population}</div>
                  </div>
                  <div className="card p-3">
                    <div className="text-2xl mb-1">🌾</div>
                    <div className="resource-food font-bold text-lg">{gameState.player.food}</div>
                  </div>
                  <div className="card p-3">
                    <div className="text-2xl mb-1">⚔️</div>
                    <div className="resource-military font-bold text-lg">{gameState.player.militaryStrength}</div>
                  </div>
                </div>
              </div>

              <div className="text-lg text-slate-300 mb-6">
                Congratulations on building a magnificent empire! Your strategic prowess has led you to victory.
              </div>

              <button
                className="btn-warning btn-micro-interaction text-xl py-4 px-8 font-bold"
                onClick={() => window.location.reload()}
              >
                <span className="flex items-center justify-center gap-3">
                  <span className="text-2xl">🎮</span>
                  <span>Play Again</span>
                </span>
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

export default App;

