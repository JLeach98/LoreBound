type CoverImageInputProps = {
  value?: string;
  errorMessage?: string;
  onChange: (image?: string) => void;
  onError: (message?: string) => void;
};

const maximumImageSize = 1_500_000;

export function CoverImageInput({
  value,
  errorMessage,
  onChange,
  onError,
}: CoverImageInputProps) {
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      onError('Choose a common image file.');
      event.target.value = '';
      return;
    }

    if (file.size > maximumImageSize) {
      onError('Choose an image smaller than 1.5 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      onError('The image could not be read.');
    };

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
        onError(undefined);
      }
    };

    reader.readAsDataURL(file);
  }

  return (
    <div className="case-form__field">
      <label htmlFor="cover-image">Cover Image</label>
      <input
        id="cover-image"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
      />
      <p className="case-form__hint">Optional. Stored locally in this browser.</p>
      {errorMessage ? <p className="case-form__error">{errorMessage}</p> : null}
      {value ? (
        <div className="case-form__cover-preview">
          <img src={value} alt="Selected cover preview" />
          <button type="button" onClick={() => onChange(undefined)}>
            Remove image
          </button>
        </div>
      ) : null}
    </div>
  );
}
