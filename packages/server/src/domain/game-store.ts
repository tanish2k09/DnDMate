import type {
  Combatant,
  CombatantGroup,
  DeviceSettings,
  GameState,
  SceneId,
} from "@dndmate/shared";
import { clampHp, createCombatant } from "./combatant";
import { CountdownTimer } from "./countdown-timer";
import type { PersistedState, StatePersister } from "./state-repository";

/** Debounce window for writing state changes to disk. */
const SAVE_DEBOUNCE_MS = 500;

export type ChangeListener = () => void;

/** Fields of a combatant that callers are allowed to update. */
export type CombatantPatch = Partial<Pick<Combatant, "name" | "currentHp" | "maxHp">>;

/**
 * The single source of truth for game state: the rosters, device settings, the
 * active scene, and the countdown timer. Mutations notify listeners and are
 * persisted to disk (debounced).
 */
export class GameStore {
  private party: Combatant[];
  private enemies: Combatant[];
  private device: DeviceSettings;
  private activeScene: SceneId;
  private readonly timer = new CountdownTimer();
  private readonly listeners = new Set<ChangeListener>();
  private saveHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    initial: PersistedState,
    private readonly persister: StatePersister,
  ) {
    this.party = initial.party;
    this.enemies = initial.enemies;
    this.device = initial.device;
    this.activeScene = initial.activeScene;
  }

  /** A complete, serialisable snapshot of the game state. */
  toState(now: number = Date.now()): GameState {
    return {
      party: this.party.map((combatant) => ({ ...combatant })),
      enemies: this.enemies.map((combatant) => ({ ...combatant })),
      device: { ...this.device },
      activeScene: this.activeScene,
      timer: this.timer.snapshot(now),
    };
  }

  // --- roster --------------------------------------------------------------

  addCombatant(group: CombatantGroup, name: string, maxHp: number): Combatant {
    const combatant = createCombatant(name, maxHp);
    this.listFor(group).push(combatant);
    this.emitChange();
    return combatant;
  }

  updateCombatant(id: string, patch: CombatantPatch): Combatant | null {
    const combatant = this.findCombatant(id);
    if (!combatant) return null;
    if (patch.name !== undefined) combatant.name = patch.name.trim() || combatant.name;
    if (patch.maxHp !== undefined) combatant.maxHp = patch.maxHp;
    if (patch.currentHp !== undefined) combatant.currentHp = patch.currentHp;
    const clamped = clampHp(combatant);
    combatant.maxHp = clamped.maxHp;
    combatant.currentHp = clamped.currentHp;
    this.emitChange();
    return { ...combatant };
  }

  removeCombatant(id: string): boolean {
    for (const list of [this.party, this.enemies]) {
      const index = list.findIndex((combatant) => combatant.id === id);
      if (index >= 0) {
        list.splice(index, 1);
        this.emitChange();
        return true;
      }
    }
    return false;
  }

  // --- settings & scene ----------------------------------------------------

  updateDeviceSettings(patch: Partial<DeviceSettings>): void {
    const next: DeviceSettings = { ...this.device, ...patch };
    next.brightness = Math.min(100, Math.max(0, Math.round(next.brightness)));
    this.device = next;
    this.emitChange();
  }

  setActiveScene(scene: SceneId): void {
    this.activeScene = scene;
    this.emitChange();
  }

  // --- timer ---------------------------------------------------------------

  startTimer(seconds: number): void {
    this.timer.start(seconds, Date.now());
    this.emitChange();
  }

  pauseTimer(): void {
    this.timer.pause(Date.now());
    this.emitChange();
  }

  resumeTimer(): void {
    this.timer.resume(Date.now());
    this.emitChange();
  }

  resetTimer(): void {
    this.timer.reset();
    this.emitChange();
  }

  addTimerSeconds(delta: number): void {
    this.timer.addSeconds(delta, Date.now());
    this.emitChange();
  }

  // --- change notification & persistence -----------------------------------

  /** Subscribe to state changes; returns an unsubscribe function. */
  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Persist pending changes immediately (e.g. on shutdown). */
  async flush(): Promise<void> {
    if (this.saveHandle) {
      clearTimeout(this.saveHandle);
      this.saveHandle = null;
    }
    await this.persister.save(this.persisted());
  }

  private persisted(): PersistedState {
    return {
      party: this.party,
      enemies: this.enemies,
      device: this.device,
      activeScene: this.activeScene,
    };
  }

  private listFor(group: CombatantGroup): Combatant[] {
    return group === "party" ? this.party : this.enemies;
  }

  private findCombatant(id: string): Combatant | undefined {
    return (
      this.party.find((combatant) => combatant.id === id) ??
      this.enemies.find((combatant) => combatant.id === id)
    );
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveHandle) {
      clearTimeout(this.saveHandle);
    }
    this.saveHandle = setTimeout(() => {
      this.saveHandle = null;
      void this.persister.save(this.persisted());
    }, SAVE_DEBOUNCE_MS);
  }
}
