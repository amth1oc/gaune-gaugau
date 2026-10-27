/**
 * MenuScreen.js — Controller màn menu chính
 */
import { SaveManager } from '../core/SaveManager.js';
import { MenuHero }    from '../effects/MenuHero.js';

export class MenuScreen {
  constructor({ screenManager, soundManager }) {
    this.sm = screenManager;
    this.sound = soundManager;
    this.hero = new MenuHero(document.getElementById('menu-hero'));
    this._setupListeners();
  }

  _setupListeners() {
    const go = (id, screen) => {
      document.getElementById(id)?.addEventListener('click', () => {
        this.sound.playClick();
        this.sm.show(screen);
      });
    };
    go('btn-play',       'character-select');
    go('btn-characters', 'character-select');
    go('btn-rankings',   'rankings');
    go('btn-settings',   'settings');
  }

  show() {
    this.hero.start();
    // Cập nhật WP display
    const wp = SaveManager.getWP();
    const el = document.getElementById('menu-wp-count');
    if (el) el.textContent = wp.toLocaleString();

    // Animate WP counter nếu vừa được thêm
    el?.classList.remove('wp-bump');
    void el?.offsetWidth;
    el?.classList.add('wp-bump');
  }

  hide() { this.hero.stop(); }
}
