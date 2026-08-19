import { Button } from '../../../shared/components/Button/Button';
import styles from './PaginaVentaTab.module.css';

/** "Página de venta" — hands off to the Page Builder, same visual blocks as the public site. */
export function PaginaVentaTab() {
  return (
    <div className={styles.card}>
      <p className={styles.text}>
        El diseño de esta página se edita con el editor visual, usando los mismos bloques del sitio público.
      </p>
      <Button variant="primary" to="/admin/paginas">
        Abrir el editor visual →
      </Button>
    </div>
  );
}
