const KofiProgress = () => {
  return (
    <div
      style={{
        height: 55,
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 10,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 0,
        paddingBottom: 0,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          padding: 0,
          margin: 0,
        }}
      >
        <iframe
          style={{
            display: 'block',
            height: '100%',
            width: '160%',
            transform: 'scale(0.625)',
            transformOrigin: '0 50%',
          }}
          frameBorder="0"
          src="https://ko-fi.com/streamalerts/goaloverlay/sa_5c72e9ee-0927-46bf-9307-ab6e8ac804df"
        />
      </div>
    </div>
  );
};

export {
  KofiProgress,
}
