const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const STATE_COLLECTION = "app_states";
const STATE_DOC_ID = "main";

async function getState() {
  try {
    const result = await db.collection(STATE_COLLECTION).doc(STATE_DOC_ID).get();
    return {
      ok: true,
      payload: result.data?.payload || null,
      updatedAt: result.data?.updatedAt || null
    };
  } catch (error) {
    if (String(error?.errMsg || "").includes("does not exist")) {
      return {
        ok: true,
        payload: null,
        updatedAt: null
      };
    }
    throw error;
  }
}

async function saveState(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Missing state payload");
  }

  const wxContext = cloud.getWXContext();
  const data = {
    payload,
    updatedAt: db.serverDate(),
    updatedBy: wxContext.OPENID || ""
  };

  try {
    await db.collection(STATE_COLLECTION).doc(STATE_DOC_ID).update({
      data
    });
  } catch (error) {
    if (String(error?.errMsg || "").includes("does not exist")) {
      await db.collection(STATE_COLLECTION).add({
        data: {
          _id: STATE_DOC_ID,
          ...data
        }
      });
    } else {
      throw error;
    }
  }

  return {
    ok: true
  };
}

exports.main = async (event = {}) => {
  const action = event.action || "get";

  if (action === "get") {
    return getState();
  }

  if (action === "save") {
    return saveState(event.payload);
  }

  throw new Error(`Unsupported state action: ${action}`);
};
