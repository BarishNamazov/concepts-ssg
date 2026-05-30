# memories: Synchronizations

The following sections, if present, describe a series of **memories** that ARE CRITICAL to keep in mind when dealing with, reasoning about, or implementing synchronizations.

# memory: Zero Matches

Usually occurring with a `where` clause in which you are looking for an array or multiple matches, there's the possibility that your queries return no frames at all. What happens then? Since the then occurs for each frame, this means **the synchronization does not fire at all**. In a sample app, ConceptBox, there was initially a synchronization for returning all files that looked like this:

```typescript
export const ListMyFilesRequest: Sync = ({ request, session, user, file, filename, results }) => ({
  when: actions([Requesting.request, { path: "/my-files", session }, { request }]),
  where: async (frames) => {
    frames = await frames.query(Sessioning._getUser, { session }, { user });
    frames = await frames.query(FileUploading._getFilesByOwner, { owner: user }, { file, filename });
    // frames = [] if no files uploaded yet!
    return frames.collectAs([file, filename], results);
  },
  then: actions([Requesting.respond, { request, results }]),
});
```

However, this would always timeout and not respond if there were no files uploaded yet. Instead, a general pattern to fix this is to be explicit about your default return value, as follows:

```typescript
import { actions, Frames, Sync } from "@engine";
import { Requesting, Sessioning, FileUploading, Sharing } from "@concepts";

export const ListMyFilesRequest: Sync = ({ request, session, user, file, filename, results }) => ({
  when: actions([Requesting.request, { path: "/my-files", session }, { request }]),
  where: async (frames) => {
    // Make sure to grab the original frame to return to the response
    const originalFrame = frames[0];
    frames = await frames.query(Sessioning._getUser, { session }, { user });
    frames = await frames.query(FileUploading._getFilesByOwner, { owner: user }, { file, filename });
    // Explicitly check if frames are empty
    if (frames.length === 0) {
      // Then join the original frame with whatever result variables you need
      const response = {...originalFrame, [results]: []}
      // Note the additional import `Frames` available from @engine 
      return new Frames(response)
    }
    return frames.collectAs([file, filename], results);
  },
  then: actions([Requesting.respond, { request, results }]),
});
```

There are only two minor additions:
1. Grabbing the original frame, as the `then` clause needs other bindings.
2. Checking for whatever empty condition you may have, then adding any binding you may need for results.

# memory: Missing actionId in `then` clause

This is an error you may occasionally encounter with malformed synchronizations, particularly in the `where` clause. It occurs primarily for two reasons:

1. Your `where` function is not properly returning a set of Frames. Make sure that the function is labeled as `async`, and that you await each call to `.query`.
2. Your frame is missing other bindings, meaning you manually created a new frame or didn't join with an original frame. See the previous example for a nice pattern to do this when you want to form an entirely new frame.
