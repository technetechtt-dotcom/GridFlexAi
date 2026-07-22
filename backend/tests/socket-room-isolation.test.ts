import type { Socket } from "socket.io";

import {
  GLOBAL_OPS_ROOM,
  joinRoomsForScope,
  organisationRoom,
  siteRoom
} from "../src/lib/socket-rooms.js";

const socketWithJoin = () => {
  const join = jest.fn(async () => undefined);
  return {
    socket: { join } as unknown as Socket,
    join
  };
};

describe("socket tenant-room isolation", () => {
  it("does not place site-only users in organisation-wide rooms", async () => {
    const { socket, join } = socketWithJoin();

    const rooms = await joinRoomsForScope(socket, {
      kind: "site",
      siteIds: ["site-a"],
      organisationIds: ["org-a"]
    });

    expect(rooms).toEqual([siteRoom("site-a")]);
    expect(join).toHaveBeenCalledWith(siteRoom("site-a"));
    expect(join).not.toHaveBeenCalledWith(organisationRoom("org-a"));
  });

  it("keeps organisation and platform scopes in their dedicated rooms", async () => {
    const organisationSocket = socketWithJoin();
    const globalSocket = socketWithJoin();

    await expect(joinRoomsForScope(organisationSocket.socket, {
      kind: "organisation",
      organisationIds: ["org-a"]
    })).resolves.toEqual([organisationRoom("org-a")]);
    await expect(joinRoomsForScope(globalSocket.socket, {
      kind: "global",
      reason: "platform_admin"
    })).resolves.toEqual([GLOBAL_OPS_ROOM]);
  });
});
