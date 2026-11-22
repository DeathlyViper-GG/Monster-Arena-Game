// Monster Arena — the hall room.
// The walking menu is one shared building: everyone standing in the menu is in
// the same hall, and this room is what puts them there. Presence only — no
// match, no simulation — so a player's step costs one small broadcast.
import { Actor } from 'base44:runtime/actors';

const MAX_USERS = 48;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, a, b, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, a, b) : fallback;
};
const clean = (s) => String(s == null ? '' : s).replace(/[<>&]/g, '').slice(0, 18).trim() || 'Player';

export default class HubRoom extends Actor {
  users = new Map(); // conn.id -> { seat, name, x, z, yaw, design, color }
  nextSeat = 1;

  // A wake (deploy, idle, hibernation) clears instance fields: keep the seats of
  // the sockets still attached and drop the rest.
  async handleStart() {
    const live = new Set(this.getConnections().map((c) => c.id));
    for (const id of [...this.users.keys()]) if (!live.has(id)) this.users.delete(id);
  }

  handleConnect(conn) {
    const u = this.claim(conn.id);
    if (!u) {
      conn.reject(4001, 'hall full');
      return;
    }
    conn.send({ type: 'you', seat: u.seat });
    this.broadcast({ type: 'hall', users: this.publicList() });
  }

  handleMessage(conn, msg) {
    if (typeof msg !== 'object' || msg === null) return;
    const u = this.claim(conn.id);
    if (!u) return;
    if (msg.type === 'move') {
      u.name = clean(msg.name);
      u.x = num(msg.x, -3000, 3000, u.x);
      u.z = num(msg.z, -3000, 3000, u.z);
      u.yaw = num(msg.yaw, -7, 7, u.yaw);
      u.design = Math.round(num(msg.design, 0, 40, u.design));
      u.color = Math.round(num(msg.color, 0, 40, u.color));
      // The seat is the only identity that ever leaves this room.
      this.broadcast({
        type: 'move',
        u: { seat: u.seat, name: u.name, x: u.x, z: u.z, yaw: u.yaw, design: u.design, color: u.color }
      });
    }
  }

  handleClose(conn) {
    const u = this.users.get(conn.id);
    if (!u) return;
    this.users.delete(conn.id);
    this.broadcast({ type: 'left', seat: u.seat });
  }

  claim(id) {
    const had = this.users.get(id);
    if (had) return had;
    if (this.users.size >= MAX_USERS) return null;
    const u = { seat: this.nextSeat++, name: 'Player', x: 0, z: 170, yaw: 0, design: 0, color: 0 };
    this.users.set(id, u);
    return u;
  }

  publicList() {
    return [...this.users.values()].map((u) => ({
      seat: u.seat, name: u.name, x: u.x, z: u.z, yaw: u.yaw, design: u.design, color: u.color
    }));
  }
}