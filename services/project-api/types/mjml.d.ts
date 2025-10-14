declare module 'mjml' {
  interface MjmlError {
    formattedMessage: string;
  }

  interface MjmlResult {
    html: string;
    errors: MjmlError[];
  }

  export default function mjml2html(input: string, options?: { validationLevel?: 'strict' | 'soft' }): MjmlResult;
}
