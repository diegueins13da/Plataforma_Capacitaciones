from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """
    Wraps DRF errors in a consistent envelope: {"errors": {...}, "status": <code>}.
    Field-level errors keep their field keys; non-field errors go under "non_field_errors".
    """
    response = exception_handler(exc, context)

    if response is not None:
        errors = response.data
        if isinstance(errors, dict):
            response.data = {"errors": errors, "status": response.status_code}
        elif isinstance(errors, list):
            response.data = {
                "errors": {"non_field_errors": errors},
                "status": response.status_code,
            }

    return response
