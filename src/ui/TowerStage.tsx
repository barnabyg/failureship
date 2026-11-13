import { useEffect, useRef, useState } from "react";
import { panelText } from "../content";
import type { Choice, Hotspot, Room } from "../engine";
import { Tower, type ScreenPoint } from "../tower/tower";

interface Props {
  rooms: readonly Room[];
  hotspots: readonly Hotspot[];
  legal: readonly Choice[];
  onChoose: (choice: Choice) => void;
  /** Once the run is over, the floor is only scenery: no labels on its places. */
  unlabelled?: boolean;
  /** A step waits for an answer: the floor is dimmed, and none of it can be taken. */
  waiting?: boolean;
}

const takable = (legal: readonly Choice[], actionId: string) =>
  legal.some((c) => c.type === "action" && c.actionId === actionId);

/** The tower with its hotspots: a model behind, and labelled buttons in front. */
export function TowerStage({
  rooms,
  hotspots,
  legal,
  onChoose,
  unlabelled = false,
  waiting = false,
}: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const tower = useRef<Tower | null>(null);
  const roomClick = useRef<(roomId: string) => void>(() => undefined);
  const [points, setPoints] = useState<Map<string, ScreenPoint>>(new Map());
  const canTake = (actionId: string) => !waiting && takable(legal, actionId);

  useEffect(() => {
    roomClick.current = (roomId) => {
      const hotspot = hotspots.find((h) => h.place === roomId);
      if (hotspot && !waiting && takable(legal, hotspot.id)) {
        onChoose({ type: "action", actionId: hotspot.id });
      }
    };
  }, [hotspots, legal, waiting, onChoose]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const built = new Tower(element, rooms, (id) => {
      roomClick.current(id);
    });
    tower.current = built;
    const observer = new ResizeObserver(() => {
      built.resize();
      setPoints(built.projectRooms());
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      built.dispose();
      tower.current = null;
    };
  }, [rooms]);

  useEffect(() => {
    const clickable = waiting
      ? []
      : hotspots.filter((h) => takable(legal, h.id));
    const done = hotspots.filter((h) => h.state === "done");
    tower.current?.setRooms(
      new Set(clickable.map((h) => h.place)),
      new Set(done.map((h) => h.place)),
    );
  }, [hotspots, legal, waiting]);

  const signed = unlabelled ? [] : rooms;
  const labelled = unlabelled ? [] : hotspots;
  return (
    <div
      className="stage"
      ref={stage}
      data-testid="stage"
      data-floor={waiting ? "waiting" : "open"}
    >
      {signed.map((room) => {
        const point = points.get(room.id);
        if (!point || !room.sign) return null;
        return (
          <div
            key={room.id}
            className="hotspot room-sign"
            data-testid={`room-sign-${room.id}`}
            style={{ left: point.x, top: point.y }}
          >
            <span className="hotspot-label">{room.sign.title}</span>
            <span className="hotspot-detail">{room.sign.detail}</span>
          </div>
        );
      })}
      {labelled.map((hotspot) => {
        const point = points.get(hotspot.place);
        if (!point) return null;
        const enabled = canTake(hotspot.id);
        return (
          <button
            key={hotspot.id}
            type="button"
            className={`hotspot hotspot-${hotspot.state}`}
            data-testid={`hotspot-${hotspot.id}`}
            style={{ left: point.x, top: point.y }}
            disabled={!enabled}
            title={hotspot.description}
            onClick={() => {
              onChoose({ type: "action", actionId: hotspot.id });
            }}
          >
            <span className="hotspot-label">{hotspot.label}</span>
            {/* What a place costs means nothing while the floor cannot be used. */}
            {!waiting && (
              <span className="hotspot-detail">
                {hotspot.state === "done"
                  ? panelText.doneLabel
                  : (hotspot.blockedBy ?? hotspot.costLabel)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
