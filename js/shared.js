const STORAGE_KEYS = {
  DRAGON: "guild_dragon_data",
  SPIRIT: "guild_spirit_data",
  GEAR: "guild_gear_data"
};

function saveData(key, value){
    localStorage.setItem(key, JSON.stringify(value));
}

function loadData(key){
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
}
