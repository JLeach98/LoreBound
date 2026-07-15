import { getInitials } from '../utils/fieldKitFormat';

type FieldKitThumbnailProps = {
  image?: string;
  name: string;
  label?: string;
};

export function FieldKitThumbnail({ image, name, label }: FieldKitThumbnailProps) {
  return (
    <span className="field-kit-thumbnail" aria-label={label ?? name}>
      {image ? <img src={image} alt="" /> : <strong>{getInitials(name)}</strong>}
    </span>
  );
}
